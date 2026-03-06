import { type FieldSchema, headerAliases } from "@/lib/file-schemas";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchConfidence = "exact" | "normalized" | "alias" | "fuzzy" | "none";

export interface SchemaFieldMatch {
  schemaField: string;
  schemaIndex: number;
  matchedUploadedHeader: string | null;
  matchedUploadedIndex: number | null;
  confidence: MatchConfidence;
}

export interface MatchResult {
  /** Overall status of the header matching attempt. */
  status: "exact-match" | "auto-resolved" | "needs-review" | "error";
  /** One entry per schema field showing what it matched to. */
  schemaMatches: SchemaFieldMatch[];
  /** Uploaded headers that didn't match any schema field. */
  unmatchedUploadedHeaders: Array<{ header: string; index: number }>;
  /**
   * Column reorder map: `columnOrder[schemaIdx] = uploadedIdx`.
   * Set when all fields are auto-resolved. Null otherwise.
   */
  columnOrder: number[] | null;
  /** The raw uploaded headers for the mapping modal dropdowns. */
  uploadedHeaders: string[];
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/** Strip to lowercase alphanumeric — handles case, underscores, spaces, hyphens, dots. */
export function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// ---------------------------------------------------------------------------
// Levenshtein distance
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[m][n];
}

/** Check if two normalized strings are close enough for a fuzzy match. */
function isFuzzyMatch(a: string, b: string): boolean {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return true;

  const dist = levenshtein(a, b);

  // Short strings: allow 1 edit. Medium: 2 edits. Long: 3 edits.
  const maxDist = maxLen <= 5 ? 1 : maxLen <= 10 ? 2 : 3;

  return dist <= maxDist && dist / maxLen < 0.35;
}

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

/** Parse a single CSV row into an array of trimmed, unquoted values. */
export function parseCsvRow(line: string): string[] {
  return line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
}

/** Read the first line of a File without loading the entire contents. */
export async function parseFirstLine(file: File): Promise<string[]> {
  const chunk = file.slice(0, 8192); // 8 KB is plenty for any header row
  const text = await chunk.text();
  const firstLine = text.split("\n")[0] ?? "";
  return parseCsvRow(firstLine);
}

/**
 * Rewrite a CSV string so that columns appear in the canonical schema order.
 *
 * - The header row is replaced with the schema's canonical field names.
 * - Every data row is reordered using `columnOrder`.
 */
export function reorderCsv(
  csvText: string,
  columnOrder: number[],
  schema: FieldSchema[],
): string {
  const lines = csvText.split("\n");
  const result: string[] = [];

  // Canonical header
  result.push(schema.map((s) => s.name).join(","));

  // Reorder each data row
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "") continue;
    const values = parseCsvRow(lines[i]);
    const reordered = columnOrder.map((idx) => values[idx] ?? "");
    result.push(reordered.join(","));
  }

  return result.join("\n");
}

// ---------------------------------------------------------------------------
// Main matching engine
// ---------------------------------------------------------------------------

export function matchHeaders(
  uploadedHeaders: string[],
  schema: FieldSchema[],
  fileType: string,
): MatchResult {
  const aliases = headerAliases[fileType] ?? {};

  // Build a lookup of normalized uploaded headers → index
  const normalizedUploaded = uploadedHeaders.map((h) => normalize(h));

  // Track which uploaded indices have been claimed
  const claimed = new Set<number>();

  // For each schema field, try to find its match in priority order
  const schemaMatches: SchemaFieldMatch[] = schema.map((field, schemaIdx) => {
    const canonicalNorm = normalize(field.name);

    // ------ Pass 1: Exact string match ------
    for (let i = 0; i < uploadedHeaders.length; i++) {
      if (claimed.has(i)) continue;
      if (uploadedHeaders[i] === field.name) {
        claimed.add(i);
        return {
          schemaField: field.name,
          schemaIndex: schemaIdx,
          matchedUploadedHeader: uploadedHeaders[i],
          matchedUploadedIndex: i,
          confidence: "exact" as const,
        };
      }
    }

    // ------ Pass 2: Normalized match ------
    for (let i = 0; i < normalizedUploaded.length; i++) {
      if (claimed.has(i)) continue;
      if (normalizedUploaded[i] === canonicalNorm) {
        claimed.add(i);
        return {
          schemaField: field.name,
          schemaIndex: schemaIdx,
          matchedUploadedHeader: uploadedHeaders[i],
          matchedUploadedIndex: i,
          confidence: "normalized" as const,
        };
      }
    }

    // ------ Pass 3: Alias match ------
    for (let i = 0; i < normalizedUploaded.length; i++) {
      if (claimed.has(i)) continue;
      const aliasTarget = aliases[normalizedUploaded[i]];
      if (aliasTarget === field.name) {
        claimed.add(i);
        return {
          schemaField: field.name,
          schemaIndex: schemaIdx,
          matchedUploadedHeader: uploadedHeaders[i],
          matchedUploadedIndex: i,
          confidence: "alias" as const,
        };
      }
    }

    // ------ Pass 4: Fuzzy (Levenshtein) match ------
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < normalizedUploaded.length; i++) {
      if (claimed.has(i)) continue;
      if (isFuzzyMatch(normalizedUploaded[i], canonicalNorm)) {
        const dist = levenshtein(normalizedUploaded[i], canonicalNorm);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }
    if (bestIdx >= 0) {
      claimed.add(bestIdx);
      return {
        schemaField: field.name,
        schemaIndex: schemaIdx,
        matchedUploadedHeader: uploadedHeaders[bestIdx],
        matchedUploadedIndex: bestIdx,
        confidence: "fuzzy" as const,
      };
    }

    // ------ No match ------
    return {
      schemaField: field.name,
      schemaIndex: schemaIdx,
      matchedUploadedHeader: null,
      matchedUploadedIndex: null,
      confidence: "none" as const,
    };
  });

  // Determine unclaimed uploaded headers
  const unmatchedUploadedHeaders = uploadedHeaders
    .map((header, index) => ({ header, index }))
    .filter(({ index }) => !claimed.has(index));

  // Classify the overall result
  const hasUnmatched = schemaMatches.some((m) => m.confidence === "none");
  const hasFuzzy = schemaMatches.some((m) => m.confidence === "fuzzy");
  const allExact = schemaMatches.every((m) => m.confidence === "exact");
  const allExactPositional =
    allExact &&
    schemaMatches.every((m) => m.matchedUploadedIndex === m.schemaIndex);

  let status: MatchResult["status"];
  let columnOrder: number[] | null = null;

  if (allExactPositional) {
    status = "exact-match";
  } else if (hasUnmatched) {
    // Some fields couldn't be matched at all
    status = hasFuzzy || unmatchedUploadedHeaders.length > 0 ? "needs-review" : "error";
  } else if (hasFuzzy) {
    // Everything matched but some are fuzzy — user should confirm
    status = "needs-review";
  } else {
    // All matched via exact/normalized/alias — safe to auto-resolve
    status = "auto-resolved";
    columnOrder = schemaMatches.map((m) => m.matchedUploadedIndex!);
  }

  return {
    status,
    schemaMatches,
    unmatchedUploadedHeaders,
    columnOrder,
    uploadedHeaders,
  };
}
