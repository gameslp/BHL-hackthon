'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMapEvents } from 'react-leaflet';
import type { LatLngBounds } from 'leaflet';
import { useBBoxBuildings } from '../hooks/useBuildings';
import 'leaflet/dist/leaflet.css';

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

function BBoxSelector({ onBBoxSelected }: { onBBoxSelected: (bounds: LatLngBounds) => void }) {
  useMapEvents({
    click(e) {
      // Simple click-based bbox selection (can be enhanced with rectangle draw tool)
      console.log('Map clicked at:', e.latlng);
    },
  });

  return null;
}

export default function Map() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [stats, setStats] = useState<BBoxStats | null>(null);
  const bboxMutation = useBBoxBuildings();

  // Default to Leszno area from example
  const defaultCenter: [number, number] = [52.123, 20.471];
  const defaultZoom = 15;

  const handleFetchBuildings = async () => {
    // Example bbox for Leszno area
    const bbox = {
      ne: { lat: 52.1250, lng: 20.4750 },
      sw: { lat: 52.1200, lng: 20.4700 },
    };

    const result = await bboxMutation.mutateAsync(bbox);
    setBuildings(result.data.buildings);
    setStats(result.data.stats);
  };

  useEffect(() => {
    // Auto-fetch on mount for demo purposes
    handleFetchBuildings();
  }, []);

  return (
    <div className="relative w-full h-screen">
      {/* Stats Panel */}
      {stats && (
        <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded-lg shadow-lg">
          <h3 className="font-bold mb-2">Statistics</h3>
          <div className="space-y-1 text-sm">
            <div>Total: {stats.total}</div>
            <div className="text-red-600">Asbestos: {stats.asbestos}</div>
            <div className="text-orange-600">Potentially: {stats.potentiallyAsbestos}</div>
            <div className="text-green-600">Clean: {stats.clean}</div>
            <div className="text-gray-600">Unknown: {stats.unknown}</div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {bboxMutation.isPending && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg">
          Loading buildings...
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <BBoxSelector onBBoxSelected={(bounds) => console.log(bounds)} />

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
