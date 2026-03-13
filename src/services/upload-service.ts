/**
 * @file Upload service — orchestrates file upload, validation, storage,
 * and post-upload bookkeeping (audit logging, versioning, event status).
 *
 * Replaces the `performUpload()` and `uploadFile()` functions from actions.ts.
 * Delegates to infrastructure for storage and to sibling services for audit
 * logging and election event updates. All functions catch errors internally
 * and return structured results (never throw).
 */

import { fileSchemas } from '@/lib/file-schemas';
import { convertShapefileToGeoJSON, validateGeoJSON } from '@/lib/shapefile-converter';
import { validateCsvRows } from '@/domain/validation/rules';
import { uploadToGCS, getGCSBucketName, generateSignedUploadUrl, readFileHead } from '@/infrastructure/storage/gcs-client';
import { CURRENT_USER } from '@/infrastructure/bigquery/client';
import { logSubmission, createFileVersion } from '@/services/audit-service';
import { updateElectionEventFileStatus } from '@/services/election-service';
import { validationMessages } from '@/content/validation-messages';

/** Maximum file size for data files (CSV): 1 GB */
const MAX_DATA_FILE_SIZE = 1024 * 1024 * 1024;

/** Maximum file size for district maps: 5 MB */
const MAX_DISTRICT_MAP_SIZE = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Upload a file (validate, store in GCS, log, version, update event). */
export async function uploadFile(params: {
  file: File;
  fileType: string;
  electionAuthorityName?: string;
  electionAuthorityType?: string;
  amendmentNotes?: string;
  electionEventId?: string;
}): Promise<{ success: boolean; message: string }> {
  const {
    file,
    fileType,
    electionAuthorityName,
    electionAuthorityType,
    amendmentNotes,
    electionEventId,
  } = params;

  const fileName = file?.name ?? 'unknown';

  // Core upload: validate + store in GCS
  const result = await performUpload(file, fileType);

  // Persist audit log — never blocks or fails the response
  await logSubmission(
    fileName,
    fileType,
    result.success,
    result.message,
    electionEventId,
  );

  // Track file version and update event status on successful upload
  if (result.success && result.gcsPath && electionAuthorityName) {
    await createFileVersion(
      fileType,
      fileName,
      result.gcsPath,
      electionAuthorityName,
      electionAuthorityType ?? '',
      amendmentNotes ?? '',
      electionEventId,
    );

    // Update election event file status
    if (electionEventId) {
      try {
        await updateElectionEventFileStatus(electionEventId, fileType, {
          uploaded: true,
          fileName,
          uploadedAt: new Date().toISOString(),
          uploadedBy: CURRENT_USER,
          version: 1,
          gcsPath: result.gcsPath,
        });
      } catch (error) {
        console.error('Failed to update election event file status:', error);
        return {
          success: false,
          message: validationMessages.genericUploadError,
        };
      }
    }
  }

  return { success: result.success, message: result.message };
}

// ---------------------------------------------------------------------------
// Internal: core upload logic (validate + GCS storage)
// ---------------------------------------------------------------------------

/** Core upload logic: validates the file (CSV schema or shapefile), uploads to GCS, and returns the result. */
async function performUpload(
  file: File,
  fileType: string,
): Promise<{ success: boolean; message: string; gcsPath?: string }> {
  const bucketName = getGCSBucketName();

  if (!bucketName || bucketName === 'your-gcs-bucket-name-here') {
    return {
      success: false,
      message: validationMessages.serverNotConfigured,
    };
  }

  if (!file || file.size === 0) {
    return { success: false, message: validationMessages.noFileProvided };
  }

  // District maps: accept .zip (shapefile) / .geojson / .json — convert to GeoJSON
  if (fileType === 'district-maps') {
    if (file.size > MAX_DISTRICT_MAP_SIZE) {
      return { success: false, message: validationMessages.fileTooLargeDistrictMaps };
    }
    return handleDistrictMapUpload(file, fileType, bucketName);
  }

  if (file.size > MAX_DATA_FILE_SIZE) {
    return { success: false, message: validationMessages.fileTooLarge };
  }

  // CSV validation path
  return handleCsvUpload(file, fileType, bucketName);
}

// ---------------------------------------------------------------------------
// District maps (shapefile / GeoJSON)
// ---------------------------------------------------------------------------

async function handleDistrictMapUpload(
  file: File,
  fileType: string,
  bucketName: string,
): Promise<{ success: boolean; message: string; gcsPath?: string }> {
  const name = file.name.toLowerCase();
  const validExtension = name.endsWith('.zip') || name.endsWith('.geojson') || name.endsWith('.json');
  if (!validExtension) {
    return {
      success: false,
      message: validationMessages.districtMaps.invalidFileType,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();

    let geojsonBuffer: Buffer;
    let geojsonFileName: string;
    let featureCount: number | undefined;

    if (name.endsWith('.zip')) {
      // Convert shapefile .zip -> GeoJSON
      const result = await convertShapefileToGeoJSON(buffer);
      if (!result.success || !result.geojson) {
        return { success: false, message: result.message };
      }

      const geojsonString = JSON.stringify(result.geojson);
      geojsonBuffer = Buffer.from(geojsonString, 'utf-8');
      geojsonFileName = file.name.replace(/\.zip$/i, '.geojson');
      featureCount = result.featureCount;

      // Also store the original .zip for reference
      const originalDest = `uploads/${fileType}/${timestamp}-${file.name}`;
      await uploadToGCS({
        bucketName,
        destination: originalDest,
        buffer,
        contentType: 'application/zip',
      });
    } else {
      // Validate and normalize uploaded .geojson / .json
      const result = validateGeoJSON(buffer);
      if (!result.success || !result.geojson) {
        return { success: false, message: result.message };
      }

      const geojsonString = JSON.stringify(result.geojson);
      geojsonBuffer = Buffer.from(geojsonString, 'utf-8');
      geojsonFileName = name.endsWith('.geojson') ? file.name : file.name.replace(/\.json$/i, '.geojson');
      featureCount = result.featureCount;
    }

    // Upload the GeoJSON to GCS
    const geojsonDest = `uploads/${fileType}/${timestamp}-${geojsonFileName}`;
    await uploadToGCS({
      bucketName,
      destination: geojsonDest,
      buffer: geojsonBuffer,
      contentType: 'application/geo+json',
      metadata: {
        'veda-file-type': fileType,
        'veda-upload-timestamp': new Date().toISOString(),
        'veda-scan-status': 'pending',
      },
    });

    const countMsg = featureCount != null ? ` (${featureCount} feature${featureCount === 1 ? '' : 's'})` : '';
    return {
      success: true,
      message: name.endsWith('.zip')
        ? validationMessages.districtMaps.shapefileConverted(file.name, countMsg)
        : validationMessages.districtMaps.geojsonUploaded(file.name, countMsg),
      gcsPath: geojsonDest,
    };
  } catch (error: unknown) {
    console.error('Error uploading to GCS:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return {
        success: false,
        message: validationMessages.gcsConnectionError,
      };
    }
    return {
      success: false,
      message: validationMessages.genericUploadError,
    };
  }
}

// ---------------------------------------------------------------------------
// CSV files
// ---------------------------------------------------------------------------

async function handleCsvUpload(
  file: File,
  fileType: string,
  bucketName: string,
): Promise<{ success: boolean; message: string; gcsPath?: string }> {
  if (file.type !== 'text/csv') {
    return { success: false, message: validationMessages.notCsv };
  }

  const schema = fileSchemas[fileType];
  if (!schema) {
    return { success: false, message: validationMessages.unrecognizedFileType(fileType) };
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileContent = buffer.toString('utf-8');
  const lines = fileContent.split('\n').filter(line => line.trim() !== '');

  // Validate CSV headers and first 5 data rows against the schema
  const validation = validateCsvRows(lines, schema);
  if (!validation.valid) {
    return { success: false, message: validation.message! };
  }

  try {
    const destination = `uploads/${fileType}/${Date.now()}-${file.name}`;

    await uploadToGCS({
      bucketName,
      destination,
      buffer,
      contentType: 'text/csv',
      metadata: {
        'veda-file-type': fileType,
        'veda-upload-timestamp': new Date().toISOString(),
        'veda-scan-status': 'pending',
      },
    });

    const rowCount = lines.length - 1; // subtract header row
    const friendlyFileType = fileType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return { success: true, message: validationMessages.uploadSuccess(friendlyFileType, rowCount), gcsPath: destination };
  } catch (error: unknown) {
    console.error('Error uploading to GCS:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return {
        success: false,
        message: validationMessages.gcsConnectionError,
      };
    }

    return {
      success: false,
      message: validationMessages.genericUploadError,
    };
  }
}

// ---------------------------------------------------------------------------
// Signed-URL upload flow (for large files — browser uploads directly to GCS)
// ---------------------------------------------------------------------------

/** Generate a signed upload URL so the browser can upload directly to GCS. */
export async function requestSignedUrl(params: {
  fileType: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}): Promise<{ success: boolean; url?: string; destination?: string; error?: string }> {
  try {
    const bucketName = getGCSBucketName();
    if (!bucketName) {
      return { success: false, error: validationMessages.serverNotConfigured };
    }

    const { fileType, fileName, contentType, fileSize } = params;

    if (!fileName) {
      return { success: false, error: validationMessages.noFileProvided };
    }

    const maxSize = fileType === 'district-maps' ? MAX_DISTRICT_MAP_SIZE : MAX_DATA_FILE_SIZE;
    if (fileSize > maxSize) {
      const msg = fileType === 'district-maps'
        ? validationMessages.fileTooLargeDistrictMaps
        : validationMessages.fileTooLarge;
      return { success: false, error: msg };
    }

    const schema = fileSchemas[fileType];
    if (!schema && fileType !== 'district-maps') {
      return { success: false, error: validationMessages.unrecognizedFileType(fileType) };
    }

    const destination = `uploads/${fileType}/${Date.now()}-${fileName}`;
    const result = await generateSignedUploadUrl({
      bucketName,
      destination,
      contentType,
      metadata: {
        'veda-file-type': fileType,
        'veda-upload-timestamp': new Date().toISOString(),
        'veda-scan-status': 'pending',
      },
    });

    return { success: true, url: result.url, destination: result.destination };
  } catch (error: unknown) {
    console.error('Error generating signed upload URL:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return { success: false, error: validationMessages.gcsConnectionError };
    }
    return { success: false, error: validationMessages.genericUploadError };
  }
}

/** Confirm a direct-to-GCS upload: validate the file, log audit, create version. */
export async function confirmFileUpload(params: {
  destination: string;
  fileType: string;
  fileName: string;
  fileSize: number;
  electionAuthorityName?: string;
  electionAuthorityType?: string;
  amendmentNotes?: string;
  electionEventId?: string;
}): Promise<{ success: boolean; message: string }> {
  const {
    destination,
    fileType,
    fileName,
    fileSize,
    electionAuthorityName,
    electionAuthorityType,
    amendmentNotes,
    electionEventId,
  } = params;

  try {
    const bucketName = getGCSBucketName();
    if (!bucketName) {
      return { success: false, message: validationMessages.serverNotConfigured };
    }

    // Validate CSV headers + sample rows from the uploaded file
    const schema = fileSchemas[fileType];
    if (!schema) {
      return { success: false, message: validationMessages.unrecognizedFileType(fileType) };
    }

    const headBuffer = await readFileHead(bucketName, destination);
    const headContent = headBuffer.toString('utf-8');
    const lines = headContent.split('\n').filter(line => line.trim() !== '');

    const validation = validateCsvRows(lines, schema);
    if (!validation.valid) {
      return { success: false, message: validation.message! };
    }

    // Estimate row count from file size (header line from head + extrapolate)
    const headerLine = lines[0] || '';
    const avgRowBytes = lines.length > 1
      ? headBuffer.length / lines.length
      : headerLine.length + 1;
    const estimatedRowCount = Math.max(1, Math.round(fileSize / avgRowBytes) - 1);

    const friendlyFileType = fileType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const successMessage = validationMessages.uploadSuccess(friendlyFileType, estimatedRowCount);

    // Audit logging
    await logSubmission(fileName, fileType, true, successMessage, electionEventId);

    // Track file version and update event status
    if (electionAuthorityName) {
      await createFileVersion(
        fileType,
        fileName,
        destination,
        electionAuthorityName,
        electionAuthorityType ?? '',
        amendmentNotes ?? '',
        electionEventId,
      );

      if (electionEventId) {
        await updateElectionEventFileStatus(electionEventId, fileType, {
          uploaded: true,
          fileName,
          uploadedAt: new Date().toISOString(),
          uploadedBy: CURRENT_USER,
          version: 1,
          gcsPath: destination,
        });
      }
    }

    return { success: true, message: successMessage };
  } catch (error: unknown) {
    console.error('Error confirming upload:', error);

    // Log the failure
    await logSubmission(
      fileName,
      fileType,
      false,
      validationMessages.genericUploadError,
      electionEventId,
    );

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return { success: false, message: validationMessages.gcsConnectionError };
    }
    return { success: false, message: validationMessages.genericUploadError };
  }
}
