import JSZip from "jszip";
import * as shapefile from "shapefile";

export interface ConversionResult {
  success: boolean;
  geojson?: GeoJSON.FeatureCollection;
  message: string;
  featureCount?: number;
}

/**
 * Extract .shp and .dbf buffers from a .zip archive.
 * Searches all entries (including nested directories) for the required files.
 */
async function extractShapefileBuffers(
  zipBuffer: Buffer,
): Promise<{ shp: Buffer; dbf: Buffer | undefined; prj: string | undefined }> {
  const zip = await JSZip.loadAsync(zipBuffer);

  let shpEntry: JSZip.JSZipObject | undefined;
  let dbfEntry: JSZip.JSZipObject | undefined;
  let prjEntry: JSZip.JSZipObject | undefined;

  zip.forEach((relativePath, entry) => {
    const lower = relativePath.toLowerCase();
    // Skip Mac OS resource forks and hidden files
    if (lower.includes("__macosx") || lower.startsWith(".")) return;

    if (lower.endsWith(".shp") && !lower.endsWith(".shp.xml")) {
      shpEntry = entry;
    } else if (lower.endsWith(".dbf")) {
      dbfEntry = entry;
    } else if (lower.endsWith(".prj")) {
      prjEntry = entry;
    }
  });

  if (!shpEntry) {
    throw new Error(
      "No .shp file found in the zip archive. Please ensure the zip contains a valid shapefile bundle (.shp, .shx, .dbf).",
    );
  }

  const shpBuffer = Buffer.from(await shpEntry.async("arraybuffer"));
  const dbfBuffer = dbfEntry
    ? Buffer.from(await dbfEntry.async("arraybuffer"))
    : undefined;
  const prjString = prjEntry ? await prjEntry.async("string") : undefined;

  return { shp: shpBuffer, dbf: dbfBuffer, prj: prjString };
}

/**
 * Convert a shapefile .zip archive to a GeoJSON FeatureCollection.
 *
 * Accepts a Buffer containing a .zip with at minimum a .shp file.
 * Returns a structured result with the parsed GeoJSON or an error message.
 */
export async function convertShapefileToGeoJSON(
  zipBuffer: Buffer,
): Promise<ConversionResult> {
  try {
    const { shp, dbf } = await extractShapefileBuffers(zipBuffer);

    const geojson = (await shapefile.read(
      shp,
      dbf,
    )) as GeoJSON.FeatureCollection;

    if (
      !geojson ||
      geojson.type !== "FeatureCollection" ||
      !Array.isArray(geojson.features)
    ) {
      return {
        success: false,
        message:
          "The shapefile could not be parsed into valid GeoJSON. Please check that the file is a valid shapefile.",
      };
    }

    if (geojson.features.length === 0) {
      return {
        success: false,
        message:
          "The shapefile contains no features. Please upload a shapefile with at least one geographic feature.",
      };
    }

    return {
      success: true,
      geojson,
      message: `Successfully converted shapefile to GeoJSON with ${geojson.features.length} feature(s).`,
      featureCount: geojson.features.length,
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Failed to convert shapefile to GeoJSON: ${detail}`,
    };
  }
}

/**
 * Validate that a buffer contains valid GeoJSON.
 * Used for .geojson / .json file uploads that don't need conversion.
 */
export function validateGeoJSON(
  buffer: Buffer,
): ConversionResult {
  try {
    const text = buffer.toString("utf-8");
    const parsed = JSON.parse(text) as GeoJSON.FeatureCollection;

    if (!parsed.type) {
      return {
        success: false,
        message:
          "The file is not valid GeoJSON — missing \"type\" property.",
      };
    }

    if (
      parsed.type !== "FeatureCollection" &&
      parsed.type !== "Feature" &&
      !["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"].includes(parsed.type)
    ) {
      return {
        success: false,
        message: `The file has an unrecognized GeoJSON type: "${parsed.type}".`,
      };
    }

    // Normalize to FeatureCollection
    let featureCollection: GeoJSON.FeatureCollection;
    if (parsed.type === "FeatureCollection") {
      featureCollection = parsed;
    } else if (parsed.type === "Feature") {
      featureCollection = {
        type: "FeatureCollection",
        features: [parsed as unknown as GeoJSON.Feature],
      };
    } else {
      // Raw geometry — wrap in Feature + FeatureCollection
      featureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: {},
            geometry: parsed as unknown as GeoJSON.Geometry,
          },
        ],
      };
    }

    return {
      success: true,
      geojson: featureCollection,
      message: `Valid GeoJSON with ${featureCollection.features.length} feature(s).`,
      featureCount: featureCollection.features.length,
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      message: `Invalid GeoJSON file: ${detail}`,
    };
  }
}
