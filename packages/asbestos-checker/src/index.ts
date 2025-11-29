import sharp from 'sharp';

/**
 * Asbestos Detection Service
 *
 * Checks if a building polygon contains asbestos by querying the Polish
 * asbestos database WMS service and analyzing pixel colors within the polygon.
 */

// Configuration
const ASBESTOS_COLOR = { r: 44, g: 137, b: 0 }; // #2c8900 - asbestos marker color
const COLOR_TOLERANCE = 10; // Color matching tolerance
const IMG_SIZE = 256; // WMS tile size
const WMS_BASE_URL = 'https://esip.bazaazbestowa.gov.pl/GeoServerProxy';

type Coordinate = [number, number]; // [longitude, latitude]

/**
 * Check if a point is inside a polygon using ray-casting algorithm
 */
function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Check if an RGB color matches the asbestos marker color
 */
function isColorMatch(r: number, g: number, b: number): boolean {
  const dist = Math.sqrt(
    Math.pow(r - ASBESTOS_COLOR.r, 2) +
    Math.pow(g - ASBESTOS_COLOR.g, 2) +
    Math.pow(b - ASBESTOS_COLOR.b, 2)
  );
  return dist <= COLOR_TOLERANCE;
}

/**
 * Calculate bounding box for a polygon with padding
 */
function calculateBoundingBox(polygon: Coordinate[]): {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
} {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of polygon) {
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Add 20% padding
  const width = maxLon - minLon;
  const height = maxLat - minLat;
  const padding = Math.max(width, height) * 0.2;

  minLon -= padding;
  maxLon += padding;
  minLat -= padding;
  maxLat += padding;

  // Force square aspect ratio (required by WMS)
  const currentWidth = maxLon - minLon;
  const currentHeight = maxLat - minLat;

  if (currentWidth > currentHeight) {
    const diff = currentWidth - currentHeight;
    minLat -= diff / 2;
    maxLat += diff / 2;
  } else {
    const diff = currentHeight - currentWidth;
    minLon -= diff / 2;
    maxLon += diff / 2;
  }

  return { minLon, minLat, maxLon, maxLat };
}

/**
 * Fetch WMS tile for given bounding box
 */
async function fetchWMSTile(bbox: {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}): Promise<Buffer> {
  const { minLon, minLat, maxLon, maxLat } = bbox;
  const bboxString = `${minLon},${minLat},${maxLon},${maxLat}`;

  const params = new URLSearchParams({
    TRANSPARENT: 'TRUE',
    FORMAT: 'image/png',
    EXCEPTIONS: '',
    LAYERS: 'budynki_z_azbestem',
    STYLES: 'budynki_z_azbestem',
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    SRS: 'EPSG:4326',
    BBOX: bboxString,
    WIDTH: IMG_SIZE.toString(),
    HEIGHT: IMG_SIZE.toString(),
  });

  const url = `${WMS_BASE_URL}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`WMS request failed: ${response.status} ${response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/**
 * Analyze WMS tile pixels to detect asbestos within polygon
 */
async function analyzePixels(
  imageBuffer: Buffer,
  polygon: Coordinate[],
  bbox: { minLon: number; minLat: number; maxLon: number; maxLat: number }
): Promise<number> {
  const { minLon, minLat, maxLon, maxLat } = bbox;

  const image = sharp(imageBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let asbestosPixelsFound = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    const alpha = data[i + 3];

    // Skip transparent pixels
    if (alpha === 0) continue;

    // Check if pixel color matches asbestos marker
    if (isColorMatch(r, g, b)) {
      // Convert pixel coordinates to geographic coordinates
      const pixelIndex = i / info.channels;
      const px = pixelIndex % info.width;
      const py = Math.floor(pixelIndex / info.width);

      const pctX = px / info.width;
      const pctY = 1 - (py / info.height); // Flip Y axis

      const pixelLon = minLon + pctX * (maxLon - minLon);
      const pixelLat = minLat + pctY * (maxLat - minLat);

      // Check if pixel is inside building polygon
      if (isPointInPolygon([pixelLon, pixelLat], polygon)) {
        asbestosPixelsFound++;
      }
    }
  }

  return asbestosPixelsFound;
}

/**
 * Check if a building polygon contains asbestos
 *
 * @param polygon - Array of [longitude, latitude] coordinates defining the building outline
 * @returns true if asbestos detected, false otherwise
 *
 * @example
 * const polygon = [[20.4714, 52.1234], [20.4715, 52.1234], [20.4715, 52.1233], [20.4714, 52.1233]];
 * const hasAsbestos = await checkBuildingForAsbestos(polygon);
 */
export async function checkBuildingForAsbestos(polygon: number[][]): Promise<boolean> {
  // Validate input
  if (!polygon || polygon.length < 3) {
    throw new Error('Invalid polygon: must have at least 3 coordinates');
  }

  // Validate coordinate format
  for (const coord of polygon) {
    if (!Array.isArray(coord) || coord.length !== 2) {
      throw new Error('Invalid coordinate format: expected [longitude, latitude]');
    }
    const [lon, lat] = coord;
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      throw new Error('Invalid coordinate values: must be numbers');
    }
  }

  const coords = polygon as Coordinate[];

  try {
    // Calculate bounding box with padding
    const bbox = calculateBoundingBox(coords);

    // Fetch WMS tile
    const imageBuffer = await fetchWMSTile(bbox);

    // Analyze pixels
    const asbestosPixelCount = await analyzePixels(imageBuffer, coords, bbox);

    // Return true if any asbestos pixels found
    return asbestosPixelCount > 0;
  } catch (error) {
    console.error('Error checking building for asbestos:', error);
    throw error;
  }
}

/**
 * Batch check multiple buildings for asbestos
 *
 * @param buildings - Array of building polygons
 * @param delayMs - Delay between requests (default: 100ms to avoid overwhelming the API)
 * @returns Array of boolean results
 */
export async function batchCheckBuildings(
  buildings: number[][][],
  delayMs: number = 100
): Promise<boolean[]> {
  const results: boolean[] = [];

  for (const building of buildings) {
    try {
      const hasAsbestos = await checkBuildingForAsbestos(building);
      results.push(hasAsbestos);

      // Delay to avoid overwhelming the WMS service
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error('Error in batch check:', error);
      results.push(false); // Default to false on error
    }
  }

  return results;
}

// Export types
export type { Coordinate };
