import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// --- TYPE DEFINITIONS ---
type Coordinate = [number, number];

interface GeoJSONPolygon {
    type: "Polygon";
    coordinates: Coordinate[][];
}

interface BuildingFeature {
    type: "Feature";
    properties: {
        building?: string;
        isAsbestos?: boolean;
        asbestosPixelCount?: number;
        [key: string]: any;
    };
    geometry: GeoJSONPolygon;
}

interface FeatureCollection {
    type: "FeatureCollection";
    features: BuildingFeature[];
}

// --- CONFIGURATION ---
const ASBESTOS_COLOR = { r: 44, g: 137, b: 0 }; // #2c8900
const COLOR_TOLERANCE = 10; // Slightly higher tolerance
const IMG_SIZE = 256; 
const INPUT_FILE = 'buildings.geojson';
const OUTPUT_FILE = 'buildings-checked.json';
const DEBUG_DIR = 'debug_output'; // Images will be saved here

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR);
}

// --- HELPER 1: Point in Polygon Algorithm ---
function isPointInPolygon(point: Coordinate, vs: Coordinate[]): boolean {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const vi = vs[i]!;
        const vj = vs[j]!;
        const xi = vi[0], yi = vi[1];
        const xj = vj[0], yj = vj[1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- HELPER 2: Color Distance ---
function isColorMatch(r: number, g: number, b: number): boolean {
    const dist = Math.sqrt(
        Math.pow(r - ASBESTOS_COLOR.r, 2) +
        Math.pow(g - ASBESTOS_COLOR.g, 2) +
        Math.pow(b - ASBESTOS_COLOR.b, 2)
    );
    return dist <= COLOR_TOLERANCE;
}

// --- CORE FUNCTION ---
async function checkBuildingForAsbestos(feature: BuildingFeature, index: number): Promise<BuildingFeature> {
    if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0]) {
        return feature; 
    }

    const coords: Coordinate[] = feature.geometry.coordinates[0];

    // 1. Calculate Bounding Box
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    coords.forEach((p) => {
        if (p[0] < minLon) minLon = p[0];
        if (p[0] > maxLon) maxLon = p[0];
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
    });

    // 2. Adjust Aspect Ratio (SQUARE)
    const width = maxLon - minLon;
    const height = maxLat - minLat;
    const padding = Math.max(width, height) * 0.2; // 20% padding
    
    let finalMinLon = minLon - padding;
    let finalMaxLon = maxLon + padding;
    let finalMinLat = minLat - padding;
    let finalMaxLat = maxLat + padding;

    const currentWidth = finalMaxLon - finalMinLon;
    const currentHeight = finalMaxLat - finalMinLat;

    // Force exact square
    if (currentWidth > currentHeight) {
        const diff = currentWidth - currentHeight;
        finalMinLat -= diff / 2;
        finalMaxLat += diff / 2;
    } else {
        const diff = currentHeight - currentWidth;
        finalMinLon -= diff / 2;
        finalMaxLon += diff / 2;
    }

    const bboxString = `${finalMinLon},${finalMinLat},${finalMaxLon},${finalMaxLat}`;
    const wmsUrl = `https://esip.bazaazbestowa.gov.pl/GeoServerProxy?TRANSPARENT=TRUE&FORMAT=image%2Fpng&EXCEPTIONS=&LAYERS=budynki_z_azbestem&STYLES=budynki_z_azbestem&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG%3A4326&BBOX=${bboxString}&WIDTH=${IMG_SIZE}&HEIGHT=${IMG_SIZE}`;

    try {
        const res = await fetch(wmsUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());

        // 4. Analyze Pixels
        const image = sharp(buffer);
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        
        let asbestosPixelsFound = 0;
        const debugDetectedPixels: {x: number, y: number}[] = [];

        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i]!;
            const g = data[i + 1]!;
            const b = data[i + 2]!;
            const alpha = data[i + 3]!;

            if (alpha === 0) continue;

            // Debug: Check if ANY color is found (even if not inside polygon yet)
            // console.log(`Color found: ${r},${g},${b}`);

            if (isColorMatch(r, g, b)) {
                const pixelIndex = i / info.channels;
                const px = pixelIndex % info.width;
                const py = Math.floor(pixelIndex / info.width);

                // Math to convert Pixel -> Geo
                const pctX = px / info.width;
                const pctY = 1 - (py / info.height); // Flip Y!
                const pixelLon = finalMinLon + (pctX * (finalMaxLon - finalMinLon));
                const pixelLat = finalMinLat + (pctY * (finalMaxLat - finalMinLat));

                if (isPointInPolygon([pixelLon, pixelLat], coords)) {
                    asbestosPixelsFound++;
                    debugDetectedPixels.push({ x: px, y: py });
                }
            }
        }

        feature.properties.isAsbestos = asbestosPixelsFound > 0;
        feature.properties.asbestosPixelCount = asbestosPixelsFound;

        // --- DEBUG: GENERATE IMAGE ---
        // We create an SVG overlay to see what the code sees
        
        // 1. Convert Building Polygon to Pixel Coordinates for drawing
        const svgPoints = coords.map(p => {
            const lon = p[0];
            const lat = p[1];
            // Geo -> Pixel Math
            const pctX = (lon - finalMinLon) / (finalMaxLon - finalMinLon);
            const pctY = (lat - finalMinLat) / (finalMaxLat - finalMinLat);
            
            const x = pctX * IMG_SIZE;
            const y = (1 - pctY) * IMG_SIZE; // Flip Y!
            return `${x},${y}`;
        }).join(' ');

        // 2. Create SVG String
        // Blue line = Building boundary
        // Red Rectangles = Detected Asbestos Pixels
        const detectedOverlay = debugDetectedPixels.map(p => 
            `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="red" />`
        ).join('\n');

        const svgOverlay = `
            <svg width="${IMG_SIZE}" height="${IMG_SIZE}">
                <polygon points="${svgPoints}" fill="none" stroke="blue" stroke-width="2" />
                ${detectedOverlay}
            </svg>
        `;

        // 3. Save Composite Image
        // Only save if it has asbestos OR if it's the first few tiles (for checking)
        if (asbestosPixelsFound > 0 || index < 3) {
            const filename = path.join(DEBUG_DIR, `bldg-${index}-${asbestosPixelsFound > 0 ? 'DETECTED' : 'CLEAN'}.png`);
            
            await sharp(buffer)
                .composite([{ input: Buffer.from(svgOverlay) }])
                .toFile(filename);
            
            console.log(`Saved debug image: ${filename}`);
        }

    } catch (error) {
        console.error(`Error processing building:`, error);
        feature.properties.error = "Failed to fetch asbestos data";
    }
    
    return feature;
}

// --- MAIN EXECUTION ---
async function processAllBuildings() {
    try {
        console.log(`Reading ${INPUT_FILE}...`);
        const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
        const geojson: FeatureCollection = JSON.parse(rawData);

        console.log(`Found ${geojson.features.length} buildings. Processing...`);

        let count = 0;
        for (const feature of geojson.features) {
            await checkBuildingForAsbestos(feature, count);
            count++;
            
            await new Promise(r => setTimeout(r, 100)); 
            
            if (feature.properties.isAsbestos) {
                console.log(`Building ${count}: ⚠️  ASBESTOS DETECTED`);
            } else {
                console.log(`Building ${count}: ✓ Clean`);
            }
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2));
        console.log(`\nDone! Results saved to ${OUTPUT_FILE}`);

    } catch (error) {
        console.error("Critical Error:", error);
    }
}

processAllBuildings();