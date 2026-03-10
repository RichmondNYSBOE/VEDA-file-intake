/**
 * @file Google Cloud Storage client operations.
 *
 * Provides a thin abstraction over the GCS SDK for uploading files and
 * reading configuration. All GCS operations used by the application should
 * flow through this module.
 */

import { Storage } from '@google-cloud/storage';

const storage = new Storage();

/** Upload a buffer to GCS. */
export async function uploadToGCS(params: {
  bucketName: string;
  destination: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  await storage.bucket(params.bucketName).file(params.destination).save(params.buffer, {
    metadata: {
      contentType: params.contentType,
      metadata: params.metadata,
    },
  });
}

/** Get the configured GCS bucket name, or null if not configured. */
export function getGCSBucketName(): string | null {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName || bucketName === 'your-gcs-bucket-name-here') {
    return null;
  }
  return bucketName;
}
