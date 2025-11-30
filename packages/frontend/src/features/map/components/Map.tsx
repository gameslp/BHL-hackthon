'use client';

import { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, ZoomControl } from 'react-leaflet';
import { useBBoxBuildings } from '../hooks/useBuildings';
import LocationSearch from './LocationSearch';
import RectangleDrawer from './RectangleDrawer';
import StatsPieChart from './StatsPieChart';
import 'leaflet/dist/leaflet.css';
import Loader from '@/components/Loader';

interface Building {
  id: string;
  polygon: number[][];
  centroid: { lng: number; lat: number };
  isAsbestos: boolean;
  isPotentiallyAsbestos: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface BBoxStats {
  total: number;
  asbestos: number;
  potentiallyAsbestos: number;
  clean: number;
  unknown: number;
}

const COLORS = {
  asbestos: '#EF4444',        // red
  potentiallyAsbestos: '#F59E0B', // orange
  clean: '#10B981',           // green
  unknown: '#6B7280',         // gray
};

function getBuildingColor(building: Building): string {
  if (building.isAsbestos) return COLORS.asbestos;
  if (building.isPotentiallyAsbestos === true) return COLORS.potentiallyAsbestos;
  if (building.isPotentiallyAsbestos === false) return COLORS.clean;
  return COLORS.unknown;
}

export default function Map() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stats, setStats] = useState<BBoxStats | null>(null);
  const bboxMutation = useBBoxBuildings();

  // Default to Leszno area from example
  const defaultCenter: [number, number] = [52.123, 20.471];
  const defaultZoom = 15;

  const handleBBoxDrawn = async (bbox: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } }) => {
    try {
      const result = await bboxMutation.mutateAsync(bbox);
      setBuildings(result.data.buildings);
      setStats(result.data.stats);
    } catch (error) {
      console.error('Failed to fetch buildings:', error);
      alert('Failed to fetch buildings. Please try a smaller area or try again later.');
    }
  };

  const handleClear = () => {
    setBuildings([]);
    setStats(null);
  };

  return (
    <div className="relative w-full h-screen">
      {/* Instructions Panel */}
      {!stats && !bboxMutation.isPending && (
        <div className="absolute top-4 right-4 z-[1000] bg-blue-50 border-2 border-blue-300 p-4 rounded-lg shadow-lg max-w-xs">
          <h3 className="font-bold mb-2 text-blue-900">How to use:</h3>
          <ol className="space-y-1 text-sm text-blue-800 list-decimal list-inside">
            <li>Use the search bar to find a location</li>
            <li>Click the rectangle tool (top-right)</li>
            <li>Draw a rectangle on the map</li>
            <li>Wait for buildings to load</li>
          </ol>
        </div>
      )}

      {/* Stats Panel with Pie Chart */}
      {stats && (
        <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-lg min-w-[280px]">
          <h3 className="font-bold mb-3 text-center">Statistics</h3>

          {/* Pie Chart */}
          <StatsPieChart stats={stats} />

          {/* Text Stats */}
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1 text-sm">
            <div className="font-semibold">Total: {stats.total}</div>
            <div className="text-red-600">Asbestos: {stats.asbestos}</div>
            <div className="text-orange-600">Potentially: {stats.potentiallyAsbestos}</div>
            {/* <div className="text-green-600">Clean: {stats.clean}</div> */}
            <div className="text-gray-600">Unknown: {stats.unknown}</div>
          </div>
        </div>
      )}

      {/* Legend */}
      {buildings.length > 0 && (
        <div className="absolute bottom-8 right-4 z-[1000] bg-white p-3 rounded-lg shadow-lg">
          <h3 className="font-bold mb-2 text-sm">Legend</h3>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.asbestos }}></div>
              <span>Asbestos Confirmed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.potentiallyAsbestos }}></div>
              <span>Potentially Asbestos</span>
            </div>
            {/* <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.clean }}></div>
              <span>Clean</span>
            </div> */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.unknown }}></div>
              <span>Building Unknown</span>
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {bboxMutation.isPending && <Loader message="Analyzing buildings in area" />}

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
        key="main-map"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Zoom control positioned below the search box */}

        <LocationSearch />
        <RectangleDrawer
          onBBoxDrawn={handleBBoxDrawn}
          onClear={handleClear}
          isLoading={bboxMutation.isPending}
        />
        <ZoomControl position="topleft" />

        {/* Render building polygons */}
        {buildings.map((building) => {
          const positions: [number, number][] = building.polygon.map(
            ([lng, lat]) => [lat, lng] // Leaflet uses [lat, lng]
          );

          return (
            <Polygon
              key={building.id}
              positions={positions}
              pathOptions={{
                color: getBuildingColor(building),
                fillColor: getBuildingColor(building),
                fillOpacity: 0.5,
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-2">
                  <div className="font-bold mb-2">Building Details</div>
                  <div className="text-sm space-y-1">
                    <div>
                      Status:{' '}
                      {building.isAsbestos
                        ? 'Asbestos'
                        : building.isPotentiallyAsbestos === true
                        ? 'Potentially Asbestos'
                        : building.isPotentiallyAsbestos === false
                        ? 'Clean'
                        : 'Unknown'}
                    </div>
                    <div>
                      Location: {building.centroid.lat.toFixed(5)}, {building.centroid.lng.toFixed(5)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Updated: {new Date(building.updatedAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}
