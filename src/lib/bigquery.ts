import { BigQuery } from "@google-cloud/bigquery";

const projectId =
  process.env.GCLOUD_PROJECT ?? process.env.GOOGLE_CLOUD_PROJECT;

export const bq = new BigQuery(projectId ? { projectId } : undefined);

/**
 * Dataset that holds all VoteVault operational tables.
 * Override with the BQ_DATASET env var if needed.
 */
export const DATASET = process.env.BQ_DATASET ?? "votevault";

/**
 * Ensure the dataset and all required tables exist.
 * Called lazily on first write so the app self-provisions.
 */
let _initialized = false;

export async function ensureSchema(): Promise<void> {
  if (_initialized) return;

  const dataset = bq.dataset(DATASET);
  const [datasetExists] = await dataset.exists();
  if (!datasetExists) {
    await dataset.create();
  }

  // --- election_events ---
  const electionEventsTable = dataset.table("election_events");
  const [eeExists] = await electionEventsTable.exists();
  if (!eeExists) {
    await dataset.createTable("election_events", {
      schema: {
        fields: [
          { name: "id", type: "STRING", mode: "REQUIRED" },
          { name: "date", type: "STRING" },
          { name: "election_type", type: "STRING" },
          { name: "election_name", type: "STRING" },
          { name: "election_authority_name", type: "STRING" },
          { name: "election_authority_type", type: "STRING" },
          { name: "created_at", type: "TIMESTAMP" },
          { name: "created_by", type: "STRING" },
          {
            name: "files",
            type: "RECORD",
            mode: "REPEATED",
            fields: [
              { name: "file_type", type: "STRING" },
              { name: "uploaded", type: "BOOLEAN" },
              { name: "file_name", type: "STRING" },
              { name: "uploaded_at", type: "STRING" },
              { name: "uploaded_by", type: "STRING" },
              { name: "version", type: "INTEGER" },
              { name: "gcs_path", type: "STRING" },
            ],
          },
        ],
      },
    });
  }

  // --- submission_logs ---
  const submissionLogsTable = dataset.table("submission_logs");
  const [slExists] = await submissionLogsTable.exists();
  if (!slExists) {
    await dataset.createTable("submission_logs", {
      schema: {
        fields: [
          { name: "id", type: "STRING", mode: "REQUIRED" },
          { name: "timestamp", type: "TIMESTAMP" },
          { name: "file_name", type: "STRING" },
          { name: "file_type", type: "STRING" },
          { name: "success", type: "BOOLEAN" },
          { name: "message", type: "STRING" },
          { name: "uploaded_by", type: "STRING" },
          { name: "election_event_id", type: "STRING" },
          { name: "scan_status", type: "STRING" },
        ],
      },
    });
  }

  // --- file_versions ---
  const fileVersionsTable = dataset.table("file_versions");
  const [fvExists] = await fileVersionsTable.exists();
  if (!fvExists) {
    await dataset.createTable("file_versions", {
      schema: {
        fields: [
          { name: "id", type: "STRING", mode: "REQUIRED" },
          { name: "file_type", type: "STRING" },
          { name: "file_name", type: "STRING" },
          { name: "gcs_path", type: "STRING" },
          { name: "version", type: "INTEGER" },
          { name: "uploaded_at", type: "TIMESTAMP" },
          { name: "election_authority_name", type: "STRING" },
          { name: "election_authority_type", type: "STRING" },
          { name: "amendment_notes", type: "STRING" },
          { name: "is_active", type: "BOOLEAN" },
          { name: "uploaded_by", type: "STRING" },
          { name: "election_event_id", type: "STRING" },
        ],
      },
    });
  }

  // --- no_elections_certifications ---
  const noCertTable = dataset.table("no_elections_certifications");
  const [ncExists] = await noCertTable.exists();
  if (!ncExists) {
    await dataset.createTable("no_elections_certifications", {
      schema: {
        fields: [
          { name: "id", type: "STRING", mode: "REQUIRED" },
          { name: "year", type: "INTEGER" },
          { name: "election_authority_name", type: "STRING" },
          { name: "election_authority_type", type: "STRING" },
          { name: "certified_at", type: "TIMESTAMP" },
          { name: "certified_by", type: "STRING" },
        ],
      },
    });
  }

  _initialized = true;
}
