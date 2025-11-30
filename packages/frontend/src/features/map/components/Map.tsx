'use client';

import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, ZoomControl, LayersControl, Pane } from 'react-leaflet';
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

const tileUrls = {
  standard: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: '© OSM contributors © CARTO',
  },
  satelite: {
    url: "https://api.maptiler.com/maps/hybrid/{z}/{x}/{y}.jpg?key=u86LQ6hm2QPhXgforzvq",
    attribution: "© MapTiler © OpenStreetMap contributors"
  }
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

      const currentLength = buildings.length;
      setBuildings(x => [...x, ...(result.data?.buildings ?? [])]);

      
      const newStats = result.data.stats;
      setStats(x => ({
        total: (x?.total || 0) + (newStats.total || 0),
        asbestos: (x?.asbestos || 0) + (newStats.asbestos || 0),
        potentiallyAsbestos: (x?.potentiallyAsbestos || 0) + (newStats.potentiallyAsbestos || 0),
        unknown: (x?.unknown || 0) + (newStats.unknown || 0),
        clean: (x?.clean || 0) + (newStats.clean || 0),
      }));
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
        fetchAddressesForBuildings(result.data.buildings, currentLength);
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
  const fetchAddressesForBuildings = async (buildingsData: Building[], startIndex: number) => {
    try {
      const coordinates = buildingsData.map(b => ({
        latitude: b.centroid.lat,
        longitude: b.centroid.lng,
      }));

      const addresses = await geocodeMutation.mutateAsync(coordinates.map(coord => ({
        latitude: coord.latitude,
        longitude: coord.longitude,
        types: ['address', 'place', 'locality'],
      })));

      // Merge addresses with buildings
      const buildingsWithAddresses: BuildingWithAddress[] = buildingsData.map((building, index) => {
        var parsed = (addresses[index].address as string)?.split(', ') ?? [];
        return {
        ...building,
        address: parsed[0] || null,
        city: parsed[1] || null,
        voivodeship: parsed[2] || null,
      }});
      

      setBuildings(x => [...x.splice(0, startIndex), ...buildingsWithAddresses]);
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

  const handleExportPDF = async () => {
    if (stats) {
      try {
        await exportTerrainReport(buildings, stats, currentBBox || undefined);
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
        <div className="absolute top-4 right-4 z-[1000] panel animate-fadeIn max-w-xs bg-white  box">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            How to use
          </h3>
          <ol className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-blue-600 font-semibold flex-shrink-0">1.</span>
              <span>Use the search bar to find a location</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-semibold flex-shrink-0">2.</span>
              <span>Click the rectangle tool (top-left)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-semibold flex-shrink-0">3.</span>
              <span>Draw a rectangle on the map</span>
            </li>
            <li className="flex gap-2">
              <span className="text-blue-600 font-semibold flex-shrink-0">4.</span>
              <span>Wait for buildings to load</span>
            </li>
          </ol>
        </div>
      )}

      {/* Stats Panel with Pie Chart */}
      {stats && (
        <div className="absolute top-4 right-4 z-[1000] panel box animate-fadeIn min-w-[300px]">
          <h3 className="font-semibold text-gray-900 mb-4 text-center flex items-center justify-center gap-2">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Statistics
          </h3>

          {/* Pie Chart */}
          <StatsPieChart stats={stats} />

          {/* Text Stats */}
          <div className="mt-4 pt-4 border-t border-gray-100 space-y-2.5 text-sm">
            <div className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="font-medium text-gray-700">Total Buildings</span>
              <span className="font-bold text-gray-900 text-base">{stats.total}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-red-50 hover:bg-red-100 transition-colors">
              <span className="font-medium text-red-700">Asbestos</span>
              <span className="font-bold text-red-600 text-base">{stats.asbestos}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-orange-50 hover:bg-orange-100 transition-colors">
              <span className="font-medium text-orange-700">Potentially</span>
              <span className="font-bold text-orange-600 text-base">{stats.potentiallyAsbestos}</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
              <span className="font-medium text-green-700">Clean</span>
              <span className="font-bold text-green-600 text-base">{stats.unknown}</span>
            </div>
          </div>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold py-2.5 px-4 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export PDF Report
          </button>
        </div>
      )}

      {/* Legend */}
      {buildings.length > 0 && (
        <div className="absolute bottom-8 right-4 z-[1000] panel animate-fadeIn">
          <h3 className="font-semibold text-gray-900 mb-2.5 text-sm flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Legend
          </h3>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2.5 hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: COLORS.asbestos }}></div>
              <span className="text-gray-700 font-medium">Asbestos Confirmed</span>
            </div>
            <div className="flex items-center gap-2.5 hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: COLORS.potentiallyAsbestos }}></div>
              <span className="text-gray-700 font-medium">Potentially Asbestos</span>
            </div>
            <div className="flex items-center gap-2.5 hover:bg-gray-50 p-1.5 rounded-lg transition-colors">
              <div className="w-5 h-5 rounded-md shadow-sm" style={{ backgroundColor: COLORS.clean }}></div>
              <span className="text-gray-700 font-medium">Clean Building</span>
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
        <LayersControl position="bottomright">
          <LayersControl.BaseLayer name="Standard" checked>
            <TileLayer url={tileUrls.standard.url} attribution={tileUrls.standard.attribution} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satelite">
            <TileLayer url={tileUrls.satelite.url} attribution={tileUrls.satelite.attribution} />
          </LayersControl.BaseLayer>
        </LayersControl>

        {/* Zoom control positioned below the search box */}

        <LocationSearch />
        <RectangleDrawer
          onBBoxDrawn={handleBBoxDrawn}
          onEntitiesClear={handleClear}
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
