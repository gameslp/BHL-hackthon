'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, ZoomControl } from 'react-leaflet';
import toast from 'react-hot-toast';
import { useBBoxBuildings } from '../hooks/useBuildings';
import { useBatchGeocode } from '../hooks/useGeocode';
import LocationSearch from './LocationSearch';
import RectangleDrawer from './RectangleDrawer';
import StatsPieChart from './StatsPieChart';
import { exportTerrainReport } from '@/lib/exportPDF';
import 'leaflet/dist/leaflet.css';
import Loader from '@/components/Loader';
import type { Building, BBoxStats, BuildingWithAddress } from '@/lib/api/generated/types.gen';

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
  const [buildings, setBuildings] = useState<BuildingWithAddress[]>([]);
  const [stats, setStats] = useState<BBoxStats | null>(null);
  const [currentBBox, setCurrentBBox] = useState<{ ne: { lat: number; lng: number }; sw: { lat: number; lng: number } } | null>(null);
  const bboxMutation = useBBoxBuildings();
  const geocodeMutation = useBatchGeocode();

  // Default to Leszno area from example
  const defaultCenter: [number, number] = [52.123, 20.471];
  const defaultZoom = 15;

  const handleBBoxDrawn = async (bbox: { ne: { lat: number; lng: number }; sw: { lat: number; lng: number } }) => {
    try {
      const result = await bboxMutation.mutateAsync(bbox);

      // Validate result structure
      if (!result.data?.buildings || !result.data?.stats) {
        throw new Error('Invalid response from server');
      }

      setBuildings(result.data.buildings);
      setStats(result.data.stats);
      setCurrentBBox(bbox);

      // Success toast
      const buildingCount = result.data.stats?.total || result.data.buildings.length;
      toast.success(
        `Successfully analyzed ${buildingCount} buildings in the selected area!`,
        {
          icon: '🏢',
        }
      );

      // Fetch addresses for buildings in background
      if (result.data.buildings.length > 0) {
        console.log('Fetching addresses for buildings...');
        fetchAddressesForBuildings(result.data.buildings);
      }
    } catch (error) {
      console.error('Failed to fetch buildings:', error);

      // Error toast with detailed message
      let errorMessage = 'Failed to fetch buildings';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      toast.error(
        `${errorMessage}. Please try a smaller area or try again later.`,
        {
          duration: 6000,
          icon: '⚠️',
        }
      );
    }
  };

  const fetchAddressesForBuildings = async (buildingsData: Building[]) => {
    try {
      const coordinates = buildingsData.map(b => ({
        latitude: b.centroid.lat,
        longitude: b.centroid.lng,
      }));

      const addresses = await geocodeMutation.mutateAsync(coordinates);

      // Merge addresses with buildings
      const buildingsWithAddresses: BuildingWithAddress[] = buildingsData.map((building, index) => ({
        ...building,
        address: addresses?.[index]?.address || null,
        city: addresses?.[index]?.city || null,
        country: addresses?.[index]?.country || null,
      }));

      setBuildings(buildingsWithAddresses);
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
      // Don't show error toast - addresses are optional enhancement
    }
  };

  const handleClear = () => {
    setBuildings([]);
    setStats(null);
    setCurrentBBox(null);
  };

  const handleExportPDF = () => {
    if (stats) {
      try {
        exportTerrainReport(buildings, stats, currentBBox || undefined);
        toast.success('PDF report downloaded successfully!', {
          icon: '📄',
        });
      } catch (error) {
        console.error('Failed to export PDF:', error);
        toast.error('Failed to generate PDF report. Please try again.', {
          icon: '❌',
        });
      }
    }
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

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg shadow transition-colors flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export PDF Report
          </button>
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
                      <span className="font-semibold">Status:</span>{' '}
                      {building.isAsbestos
                        ? 'Asbestos'
                        : building.isPotentiallyAsbestos === true
                        ? 'Potentially Asbestos'
                        : building.isPotentiallyAsbestos === false
                        ? 'Clean'
                        : 'Unknown'}
                    </div>
                    {building.address && (
                      <div>
                        <span className="font-semibold">Address:</span> {building.address}
                      </div>
                    )}
                    {building.city && (
                      <div>
                        <span className="font-semibold">City:</span> {building.city}
                      </div>
                    )}
                    {!building.address && (
                      <div>
                        <span className="font-semibold">Coordinates:</span> {building.centroid.lat.toFixed(5)}, {building.centroid.lng.toFixed(5)}
                      </div>
                    )}
                    <div className="text-xs text-gray-500 pt-1 border-t border-gray-200">
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
