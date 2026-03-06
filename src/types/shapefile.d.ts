declare module "shapefile" {
  import type { FeatureCollection } from "geojson";

  export function read(
    shp: Buffer | ArrayBuffer | string,
    dbf?: Buffer | ArrayBuffer | string,
    options?: Record<string, unknown>,
  ): Promise<FeatureCollection>;

  export function open(
    shp: Buffer | ArrayBuffer | string,
    dbf?: Buffer | ArrayBuffer | string,
    options?: Record<string, unknown>,
  ): Promise<{
    read(): Promise<{ done: boolean; value: GeoJSON.Feature }>;
    bbox: [number, number, number, number];
  }>;

  export function openShp(
    shp: Buffer | ArrayBuffer | string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;

  export function openDbf(
    dbf: Buffer | ArrayBuffer | string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
}
