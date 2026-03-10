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
import { uploadToGCS, getGCSBucketName } from '@/infrastructure/storage/gcs-client';
import { CURRENT_USER } from '@/infrastructure/bigquery/client';
import { logSubmission, createFileVersion } from '@/services/audit-service';
import { updateElectionEventFileStatus } from '@/services/election-service';

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

  // Track file version on successful upload
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
      await updateElectionEventFileStatus(electionEventId, fileType, {
        uploaded: true,
        fileName,
        uploadedAt: new Date().toISOString(),
        uploadedBy: CURRENT_USER,
        version: 1,
        gcsPath: result.gcsPath,
      });
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
      message: 'The server is not properly configured for file storage. Please contact your administrator.',
    };
  }

  if (!file || file.size === 0) {
    return { success: false, message: 'No file was provided. Please select a file and try again.' };
  }

  if (file.size > 5 * 1024 * 1024) {
    return { success: false, message: 'This file is too large. The maximum allowed size is 5 MB. Please reduce the file size and try again.' };
  }

  // District maps: accept .zip (shapefile) / .geojson / .json — convert to GeoJSON
  if (fileType === 'district-maps') {
    return handleDistrictMapUpload(file, fileType, bucketName);
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
      message: 'This file type is not accepted for District Maps. Please upload a .zip file (containing shapefiles) or a .geojson file.',
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
        ? `${file.name} was converted to GeoJSON and uploaded successfully${countMsg}.`
        : `${file.name} has been uploaded successfully${countMsg}.`,
      gcsPath: geojsonDest,
    };
  } catch (error: unknown) {
    console.error('Error uploading to GCS:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return {
        success: false,
        message: 'There was a temporary problem connecting to the file storage service. Please wait a moment and try again.',
      };
    }
    return {
      success: false,
      message: 'There was a problem uploading your file. Please try again. If the problem continues, contact your administrator.',
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
    return { success: false, message: 'This file is not a CSV. Please upload a .csv file.' };
  }

  const schema = fileSchemas[fileType];
  if (!schema) {
    return { success: false, message: `We don't recognize this file type ("${fileType}"). Please try a different upload option.` };
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
    return { success: true, message: `${friendlyFileType} successfully uploaded — ${rowCount} row${rowCount !== 1 ? 's' : ''}.`, gcsPath: destination };
  } catch (error: unknown) {
    console.error('Error uploading to GCS:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Could not refresh access token')) {
      return {
        success: false,
        message: 'There was a temporary problem connecting to the file storage service. Please wait a moment and try again.',
      };
    }

    return {
      success: false,
      message: 'There was a problem uploading your file. Please try again. If the problem continues, contact your administrator.',
    };
  }
}
