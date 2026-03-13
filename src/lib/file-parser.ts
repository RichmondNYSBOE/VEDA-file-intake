/**
 * @file Multi-format file parser that normalizes CSV, Excel (.xlsx/.xls), JSON,
 * and pasted tab-delimited data into a uniform {@link ParsedData} structure
 * (headers + rows). Also provides {@link toCsvString} to serialize back to CSV
 * for upload.
 */

import * as XLSX from "xlsx";

/**
 * Parsed tabular data from any supported file format.
 */
export interface ParsedData {
  headers: string[];
  rows: string[][];
  /** The format the data was parsed from. */
  sourceFormat: "csv" | "xlsx" | "json" | "paste";
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

/** Parse a CSV string into headers + rows. */
export function parseCsvString(text: string): ParsedData {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { headers: [], rows: [], sourceFormat: "csv" };
  }

  const headers = parseCsvRow(lines[0]);
  const rows = lines.slice(1).map(parseCsvRow);
  return { headers, rows, sourceFormat: "csv" };
}

function parseCsvRow(line: string): string[] {
  return line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
}

// ---------------------------------------------------------------------------
// XLSX / XLS
// ---------------------------------------------------------------------------

/** Parse an Excel file (ArrayBuffer) into headers + rows. */
export function parseExcelBuffer(buffer: ArrayBuffer): ParsedData {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], sourceFormat: "xlsx" };
  }

  const sheet = workbook.Sheets[sheetName];
  // Convert to an array of arrays (header: 1 means raw arrays, no key mapping)
  const raw: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false, // return formatted strings so dates come out as text
    dateNF: 'm/d/yyyy', // normalize dates to 4-digit years regardless of cell format
  });

  if (raw.length === 0) {
    return { headers: [], rows: [], sourceFormat: "xlsx" };
  }

  const headers = raw[0].map((v) => String(v).trim());
  const rows = raw.slice(1).map((r) => r.map((v) => String(v).trim()));

  return { headers, rows, sourceFormat: "xlsx" };
}

// ---------------------------------------------------------------------------
// JSON (array of objects)
// ---------------------------------------------------------------------------

/** Parse a JSON file (string content) into headers + rows. */
export function parseJsonString(text: string): ParsedData {
  const data = JSON.parse(text);

  if (!Array.isArray(data) || data.length === 0) {
    return { headers: [], rows: [], sourceFormat: "json" };
  }

  // Use keys from the first object as headers
  const headers = Object.keys(data[0]).map((k) => String(k).trim());
  const rows = data.map((obj: Record<string, unknown>) =>
    headers.map((h) => {
      const val = obj[h];
      return val === null || val === undefined ? "" : String(val).trim();
    }),
  );

  return { headers, rows, sourceFormat: "json" };
}

// ---------------------------------------------------------------------------
// Tab-delimited paste
// ---------------------------------------------------------------------------

/** Parse tab-delimited text (from spreadsheet copy-paste) into headers + rows. */
export function parseTabDelimited(text: string): ParsedData {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return { headers: [], rows: [], sourceFormat: "paste" };
  }

  const headers = lines[0].split("\t").map((v) => v.trim());
  const rows = lines.slice(1).map((line) =>
    line.split("\t").map((v) => v.trim()),
  );

  return { headers, rows, sourceFormat: "paste" };
}

// ---------------------------------------------------------------------------
// Unified file parser
// ---------------------------------------------------------------------------

/**
 * Detect format by file extension/type and parse into a uniform structure.
 */
export async function parseFile(file: File): Promise<ParsedData> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    return parseExcelBuffer(buffer);
  }

  if (name.endsWith(".json")) {
    const text = await file.text();
    return parseJsonString(text);
  }

  // Default: treat as CSV
  const text = await file.text();
  return parseCsvString(text);
}

// ---------------------------------------------------------------------------
// Chunk-only parser (for large CSV files)
// ---------------------------------------------------------------------------

/** Size threshold above which we only read the head of a CSV. */
const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB

/** Default number of bytes to read from a large file for header validation. */
const HEAD_BYTES = 65536; // 64 KB

/**
 * Parse only the first chunk of a file. For CSV files larger than 10 MB this
 * avoids loading hundreds of megabytes into browser memory just for header
 * validation and data preview.
 *
 * For Excel/JSON files (which are unlikely to be huge) this falls back to
 * the full {@link parseFile}.
 */
export async function parseFileHead(file: File): Promise<ParsedData> {
  const name = file.name.toLowerCase();

  // Excel and JSON: always parse fully (they won't be 500 MB)
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".json")) {
    return parseFile(file);
  }

  // Small CSVs: parse fully for complete data preview
  if (file.size <= LARGE_FILE_THRESHOLD) {
    return parseFile(file);
  }

  // Large CSV: read only the first chunk
  const blob = file.slice(0, HEAD_BYTES);
  const text = await blob.text();

  // Drop the last line — it's likely truncated mid-row
  const lines = text.split("\n");
  if (lines.length > 1) {
    lines.pop();
  }
  const cleanText = lines.join("\n");

  return parseCsvString(cleanText);
}

// ---------------------------------------------------------------------------
// Convert ParsedData back to CSV string for upload
// ---------------------------------------------------------------------------

/** Serialize parsed data into a CSV string suitable for upload to the server. */
export function toCsvString(data: ParsedData): string {
  const escapeCsv = (val: string): string => {
    // Prevent CSV formula injection: prefix dangerous leading characters with
    // a single-quote so spreadsheet applications treat the cell as plain text.
    if (/^[=+\-@\t\r]/.test(val)) {
      val = `'${val}`;
    }
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const headerLine = data.headers.map(escapeCsv).join(",");
  const dataLines = data.rows.map((row) => row.map(escapeCsv).join(","));

  return [headerLine, ...dataLines].join("\n");
}
