
const { parentPort } = require('worker_threads');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

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

    const bboxString = `${finalMinLon},${finalMinLat},${finalMaxLon},${finalMaxLat}`;
    const wmsUrl = `https://esip.bazaazbestowa.gov.pl/GeoServerProxy?TRANSPARENT=TRUE&FORMAT=image%2Fpng&EXCEPTIONS=&LAYERS=budynki_z_azbestem&STYLES=budynki_z_azbestem&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&SRS=EPSG%3A4326&BBOX=${bboxString}&WIDTH=${IMG_SIZE}&HEIGHT=${IMG_SIZE}`;

    try {
        const res = await fetch(wmsUrl);
        if (!res.ok) throw new Error(`Status ${res.status}`);
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
                return `${x},${y}`;
            }).join(' ');

            const detectedOverlay = debugDetectedPixels.map(p => 
                `<rect x="${p.x}" y="${p.y}" width="1" height="1" fill="red" />`
            ).join('\n');

            const svgOverlay = `
                <svg width="${IMG_SIZE}" height="${IMG_SIZE}">
                    <polygon points="${svgPoints}" fill="none" stroke="blue" stroke-width="2" />
                    ${detectedOverlay}
                </svg>
            `;

            const filename = path.join(DEBUG_DIR, `bldg-${index}-${asbestosPixelsFound > 0 ? 'DETECTED' : 'CLEAN'}.png`);
            
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
