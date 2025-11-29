'use client';

import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';

interface BBox {
  ne: { lat: number; lng: number };
  sw: { lat: number; lng: number };
}

interface RectangleDrawerProps {
  onBBoxDrawn: (bbox: BBox) => void;
  onClear?: () => void;
  isLoading?: boolean;
}

export default function RectangleDrawer({ onBBoxDrawn, onClear, isLoading = false }: RectangleDrawerProps) {
  const map = useMap();
  const drawControlRef = useRef<L.Control.Draw | null>(null);
  const drawnLayersRef = useRef<L.FeatureGroup | null>(null);
  const [hasRectangle, setHasRectangle] = useState(false);

  useEffect(() => {
    // Initialize feature group for drawn items
    if (!drawnLayersRef.current) {
      drawnLayersRef.current = new L.FeatureGroup();
      map.addLayer(drawnLayersRef.current);
    }

    // Initialize draw control - only draw rectangle, no edit controls
    if (!drawControlRef.current) {
      const drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
          rectangle: {
            shapeOptions: {
              color: '#3b82f6',
              weight: 2,
              fillOpacity: 0.1,
            },
          },
          polygon: false,
          polyline: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: false, // Disable all edit controls
      });

      map.addControl(drawControl);
      drawControlRef.current = drawControl;
    }

    // Handle rectangle creation
    const handleDrawCreated = (e: any) => {
      const layer = e.layer;
      const bounds = layer.getBounds();

      // Clear previous rectangles
      if (drawnLayersRef.current) {
        drawnLayersRef.current.clearLayers();
      }

      // Add new rectangle
      if (drawnLayersRef.current) {
        drawnLayersRef.current.addLayer(layer);
      }

      // Extract bbox coordinates
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();

      const bbox: BBox = {
        ne: { lat: ne.lat, lng: ne.lng },
        sw: { lat: sw.lat, lng: sw.lng },
      };

      // Calculate area to validate
      const latDiff = Math.abs(ne.lat - sw.lat);
      const lngDiff = Math.abs(ne.lng - sw.lng);
      const approximateArea = latDiff * lngDiff;

      // Warn if area is too large (adjust threshold as needed)
      if (approximateArea > 0.01) {
        alert('Warning: Selected area is very large. This may take a while to process.');
      }

      onBBoxDrawn(bbox);
      setHasRectangle(true);
    };

    map.on(L.Draw.Event.CREATED, handleDrawCreated);

    // Cleanup
    return () => {
      map.off(L.Draw.Event.CREATED, handleDrawCreated);
    };
  }, [map, onBBoxDrawn]);

  // Disable drawing controls when loading
  useEffect(() => {
    const container = map.getContainer();
    const drawButtons = container.querySelectorAll('.leaflet-draw-draw-rectangle');

    drawButtons.forEach((button) => {
      if (isLoading) {
        button.classList.add('leaflet-disabled');
        (button as HTMLElement).style.pointerEvents = 'none';
        (button as HTMLElement).style.opacity = '0.5';
      } else {
        button.classList.remove('leaflet-disabled');
        (button as HTMLElement).style.pointerEvents = 'auto';
        (button as HTMLElement).style.opacity = '1';
      }
    });
  }, [isLoading, map]);

  // Handle clear button click
  const handleClearClick = () => {
    if (drawnLayersRef.current) {
      drawnLayersRef.current.clearLayers();
    }
    setHasRectangle(false);
    if (onClear) {
      onClear();
    }
  };

  return (
    <>
      {hasRectangle && (
        // <div className="absolute top-[152px] left-12 z-[1000]">
        <div className="absolute top-20 left-14 z-[1000]">
          <button
            onClick={handleClearClick}
            disabled={isLoading}
            className="bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed px-3 py-2 rounded shadow-md border border-gray-300 flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            Clear Selection
          </button>
        </div>
      )}
    </>
  );
}
