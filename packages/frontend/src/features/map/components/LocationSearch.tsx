'use client';

import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { useGeocoding } from '../hooks/useGeocoding';
import type { GeocodeResult } from '@/lib/api/generated/types.gen';

export default function LocationSearch() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const map = useMap();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Use React Query hook for geocoding
  const { data: geocodeData, isLoading, error } = useGeocoding(debouncedQuery);
  const results = geocodeData || [];

  // Debounced search on input change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.trim().length > 2) {
      debounceTimer.current = setTimeout(() => {
        setDebouncedQuery(query);
        setShowResults(true);
      }, 500); // 500ms debounce
    } else {
      setDebouncedQuery('');
      setShowResults(false);
    }

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length > 2) {
      setDebouncedQuery(query);
      setShowResults(true);
    }
  };

  const handleSelectLocation = (result: GeocodeResult) => {
    const [lng, lat] = result.center;

    // Fly to the selected location
    map.flyTo([lat, lng], 15, {
      duration: 1.5,
    });

    setShowResults(false);
    setQuery(result.placeName);
  };

  return (
    <div className="absolute top-4 left-4 z-[1000] w-80">
      <form onSubmit={handleSearch} className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            placeholder="Search for a location..."
            className="flex-1 px-4 py-2 bg-white rounded-lg shadow-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
            {results.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectLocation(result)}
                className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 transition-colors"
              >
                <div className="font-medium text-sm text-gray-900">
                  {result.placeName}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Error Message */}
        {showResults && error && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-red-200 px-4 py-3">
            <p className="text-sm text-red-500">Failed to search location. Please try again.</p>
          </div>
        )}

        {/* No Results */}
        {showResults && results.length === 0 && query && !isLoading && (
          <div className="absolute top-full mt-2 w-full bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3">
            <p className="text-sm text-gray-500">No results found</p>
          </div>
        )}
      </form>

      {/* Click outside to close */}
      {showResults && (
        <div
          className="fixed inset-0 z-[-1]"
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
}
