import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

interface WorkerTask {
    feature: BuildingFeature;
    index: number;
}

interface WorkerResult {
    feature: BuildingFeature;
    index: number;
    success: boolean;
    error?: string;
}

// --- CONFIGURATION ---
const ASBESTOS_COLOR = { r: 44, g: 137, b: 0 }; // #2c8900
const COLOR_TOLERANCE = 10;
const IMG_SIZE = 256;
const INPUT_FILE = '/Users/silniczekroot/PycharmProjects/BHL-hackthon/MapParser/buildings.geojson';
const OUTPUT_FILE = 'buildings-checked.json';
const DEBUG_DIR = 'debug_output';
const MAX_WORKERS = os.cpus().length * 4; // Use 4x CPU cores for I/O bound tasks
const DELAY_BETWEEN_REQUESTS = 10; // Reduce delay to 10ms for faster processing

// Ensure debug directory exists
if (!fs.existsSync(DEBUG_DIR)) {
    fs.mkdirSync(DEBUG_DIR);
}

// --- WORKER CODE (will be saved to separate file) ---
const workerCode = `
import { parentPort } from 'worker_threads';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const ASBESTOS_COLOR = { r: 44, g: 137, b: 0 };
const COLOR_TOLERANCE = 10;
const IMG_SIZE = 256;
const DEBUG_DIR = 'debug_output';

function isPointInPolygon(point, vs) {
    const x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const vi = vs[i];
        const vj = vs[j];
        const xi = vi[0], yi = vi[1];
        const xj = vj[0], yj = vj[1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isColorMatch(r, g, b) {
    const dist = Math.sqrt(
        Math.pow(r - ASBESTOS_COLOR.r, 2) +
        Math.pow(g - ASBESTOS_COLOR.g, 2) +
        Math.pow(b - ASBESTOS_COLOR.b, 2)
    );
    return dist <= COLOR_TOLERANCE;
}

async function processBuilding(feature, index) {
    if (!feature.geometry || !feature.geometry.coordinates || !feature.geometry.coordinates[0]) {
        return { feature, index, success: true };
    }

    const coords = feature.geometry.coordinates[0];

    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
    coords.forEach((p) => {
        if (p[0] < minLon) minLon = p[0];
        if (p[0] > maxLon) maxLon = p[0];
        if (p[1] < minLat) minLat = p[1];
        if (p[1] > maxLat) maxLat = p[1];
    });

    const width = maxLon - minLon;
    const height = maxLat - minLat;
    const padding = Math.max(width, height) * 0.2;
    
    let finalMinLon = minLon - padding;
    let finalMaxLon = maxLon + padding;
    let finalMinLat = minLat - padding;
    let finalMaxLat = maxLat + padding;

    const currentWidth = finalMaxLon - finalMinLon;
    const currentHeight = finalMaxLat - finalMinLat;

    if (currentWidth > currentHeight) {
        const diff = currentWidth - currentHeight;
        finalMinLat -= diff / 2;
        finalMaxLat += diff / 2;
    } else {
        const diff = currentHeight - currentWidth;
        finalMinLon -= diff / 2;
        finalMaxLon += diff / 2;
    }

    const bboxString = \`\${finalMinLon},\${finalMinLat},\${finalMaxLon},\${finalMaxLat}\`;
    const wmsUrl = \`https://esip.bazaazbestowa.gov.pl/GeoServerProxy?TRANSPARENT=TRUE&FORMAT=image%2Fpng&EXCEPTIONS=&LAYERS=budynki_z_azbestem&STYLES=budynki_z_azbestem&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG%3A4326&BBOX=\${bboxString}&WIDTH=\${IMG_SIZE}&HEIGHT=\${IMG_SIZE}\`;

    try {
        const res = await fetch(wmsUrl);
        if (!res.ok) throw new Error(\`Status \${res.status}\`);
        const buffer = Buffer.from(await res.arrayBuffer());

        const image = sharp(buffer);
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        
        let asbestosPixelsFound = 0;
        const debugDetectedPixels = [];

        for (let i = 0; i < data.length; i += info.channels) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const alpha = data[i + 3];

            if (alpha === 0) continue;

            if (isColorMatch(r, g, b)) {
                const pixelIndex = i / info.channels;
                const px = pixelIndex % info.width;
                const py = Math.floor(pixelIndex / info.width);

                const pctX = px / info.width;
                const pctY = 1 - (py / info.height);
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

        if (asbestosPixelsFound > 0 || index < 3) {
            const svgPoints = coords.map(p => {
                const lon = p[0];
                const lat = p[1];
                const pctX = (lon - finalMinLon) / (finalMaxLon - finalMinLon);
                const pctY = (lat - finalMinLat) / (finalMaxLat - finalMinLat);
                
                const x = pctX * IMG_SIZE;
                const y = (1 - pctY) * IMG_SIZE;
                return \`\${x},\${y}\`;
            }).join(' ');

            const detectedOverlay = debugDetectedPixels.map(p => 
                \`<rect x="\${p.x}" y="\${p.y}" width="1" height="1" fill="red" />\`
            ).join('\\n');

            const svgOverlay = \`
                <svg width="\${IMG_SIZE}" height="\${IMG_SIZE}">
                    <polygon points="\${svgPoints}" fill="none" stroke="blue" stroke-width="2" />
                    \${detectedOverlay}
                </svg>
            \`;

            const filename = path.join(DEBUG_DIR, \`bldg-\${index}-\${asbestosPixelsFound > 0 ? 'DETECTED' : 'CLEAN'}.png\`);
            
            await sharp(buffer)
                .composite([{ input: Buffer.from(svgOverlay) }])
                .toFile(filename);
        }

        return { feature, index, success: true };

    } catch (error) {
        feature.properties.error = "Failed to fetch asbestos data";
        return { feature, index, success: false, error: error.message };
    }
}

parentPort.on('message', async (task) => {
    const result = await processBuilding(task.feature, task.index);
    parentPort.postMessage(result);
});
`;

// Save worker code to file (use .mjs for ES modules)
const workerPath = path.join(__dirname, 'worker.mjs');
fs.writeFileSync(workerPath, workerCode);

// --- WORKER POOL MANAGEMENT ---
class WorkerPool {
    private workers: Worker[] = [];
    private availableWorkers: Worker[] = [];
    private taskQueue: WorkerTask[] = [];
    private activeCount = 0;
    private results: Map<number, BuildingFeature> = new Map();
    private totalTasks = 0;
    private completedTasks = 0;
    private startTime = Date.now();

    constructor(private maxWorkers: number) {
        for (let i = 0; i < maxWorkers; i++) {
            const worker = new Worker(workerPath);
            this.workers.push(worker);
            this.availableWorkers.push(worker);
            
            worker.on('message', (result: WorkerResult) => {
                this.handleResult(result);
                this.activeCount--;
                this.availableWorkers.push(worker);
                this.processQueue();
            });

            worker.on('error', (error) => {
                console.error('Worker error:', error);
                this.activeCount--;
                this.availableWorkers.push(worker);
                this.processQueue();
            });
        }
    }

    async addTask(task: WorkerTask): Promise<void> {
        this.totalTasks++;
        this.taskQueue.push(task);
        await this.processQueue();
    }

    private async processQueue(): Promise<void> {
        while (this.availableWorkers.length > 0 && this.taskQueue.length > 0) {
            const worker = this.availableWorkers.pop()!;
            const task = this.taskQueue.shift()!;
            
            this.activeCount++;
            worker.postMessage(task);
            
            // Small delay to avoid hammering the API
            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_REQUESTS));
        }
    }

    private handleResult(result: WorkerResult): void {
        this.completedTasks++;
        this.results.set(result.index, result.feature);

        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = this.completedTasks / elapsed;
        const remaining = this.totalTasks - this.completedTasks;
        const eta = remaining / rate;

        if (result.feature.properties.isAsbestos) {
            console.log(`[${this.completedTasks}/${this.totalTasks}] Building ${result.index}: ⚠️  ASBESTOS DETECTED (ETA: ${eta.toFixed(0)}s)`);
        } else if (this.completedTasks % 10 === 0) {
            console.log(`[${this.completedTasks}/${this.totalTasks}] Progress: ${(this.completedTasks / this.totalTasks * 100).toFixed(1)}% (ETA: ${eta.toFixed(0)}s)`);
        }
    }

    async waitForCompletion(): Promise<BuildingFeature[]> {
        while (this.completedTasks < this.totalTasks || this.activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Return results in original order
        const orderedResults: BuildingFeature[] = [];
        for (let i = 0; i < this.totalTasks; i++) {
            const feature = this.results.get(i);
            if (feature) {
                orderedResults.push(feature);
            }
        }

        return orderedResults;
    }

    terminate(): void {
        this.workers.forEach(worker => worker.terminate());
    }
}

// --- MAIN EXECUTION ---
async function processAllBuildings() {
    try {
        console.log(`Reading ${INPUT_FILE}...`);
        const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
        const geojson: FeatureCollection = JSON.parse(rawData);

        console.log(`Found ${geojson.features.length} buildings.`);
        console.log(`Using ${MAX_WORKERS} worker threads...`);
        console.log(`Starting processing...\n`);

        const pool = new WorkerPool(MAX_WORKERS);
        const startTime = Date.now();

        // Add all tasks
        for (let i = 0; i < geojson.features.length; i++) {
            await pool.addTask({
                feature: geojson.features[i]!,
                index: i
            });
        }

        // Wait for completion
        const processedFeatures = await pool.waitForCompletion();
        pool.terminate();

        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`\n✓ All buildings processed in ${elapsed.toFixed(1)}s`);

        // Update geojson with processed features
        geojson.features = processedFeatures;

        // Save results
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(geojson, null, 2));
        console.log(`Results saved to ${OUTPUT_FILE}`);

        // Statistics
        const asbestosCount = processedFeatures.filter(f => f.properties.isAsbestos).length;
        const cleanCount = processedFeatures.length - asbestosCount;
        console.log(`\nStatistics:`);
        console.log(`  ⚠️  With asbestos: ${asbestosCount}`);
        console.log(`  ✓ Clean: ${cleanCount}`);
        console.log(`  Rate: ${(processedFeatures.length / elapsed).toFixed(2)} buildings/second`);

        // Cleanup worker file
        fs.unlinkSync(workerPath);

    } catch (error) {
        console.error("Critical Error:", error);
        // Cleanup worker file on error
        if (fs.existsSync(workerPath)) {
            fs.unlinkSync(workerPath);
        }
    }
}

processAllBuildings();

// npx tsx index-multithreaded.ts