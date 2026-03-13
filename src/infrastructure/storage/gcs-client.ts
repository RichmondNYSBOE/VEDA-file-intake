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

/**
 * Generate a v4 signed URL for resumable upload directly from the browser.
 * The URL is valid for 30 minutes.
 */
export async function generateSignedUploadUrl(params: {
  bucketName: string;
  destination: string;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<{ url: string; destination: string }> {
  const file = storage.bucket(params.bucketName).file(params.destination);

  const extensionHeaders: Record<string, string> = {};
  if (params.metadata) {
    for (const [key, value] of Object.entries(params.metadata)) {
      extensionHeaders[`x-goog-meta-${key}`] = value;
    }
  }

  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'resumable',
    expires: Date.now() + 30 * 60 * 1000, // 30 minutes
    contentType: params.contentType,
    extensionHeaders,
  });

  return { url, destination: params.destination };
}

/**
 * Read the first N bytes of a file stored in GCS.
 * Used for server-side header/row validation after a direct browser upload.
 */
export async function readFileHead(
  bucketName: string,
  filePath: string,
  bytes: number = 65536,
): Promise<Buffer> {
  const file = storage.bucket(bucketName).file(filePath);
  const [contents] = await file.download({ start: 0, end: bytes - 1 });
  return contents;
}

/** Get the configured GCS bucket name, or null if not configured. */
export function getGCSBucketName(): string | null {
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName || bucketName === 'your-gcs-bucket-name-here') {
    return null;
  }
  return bucketName;
}
