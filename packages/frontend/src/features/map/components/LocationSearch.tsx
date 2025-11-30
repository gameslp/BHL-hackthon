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
      <form onSubmit={handleSearch} className="relative animate-fadeIn">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setShowResults(true)}
              placeholder="Search for a location..."
              className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-lg hover:shadow-xl"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>

        {/* Search Results Dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-2 w-full panel max-h-60 overflow-y-auto animate-fadeIn">
            {results.map((result, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectLocation(result)}
                className="w-full text-left px-3 py-2.5 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 group"
              >
                <svg className="h-4 w-4 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium text-sm text-gray-900">{result.placeName}</span>
              </button>
            ))}
          </div>
        )}

        {/* Error Message */}
        {showResults && error && (
          <div className="absolute top-full mt-2 w-full panel border-l-4 border-red-500 animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-600 font-medium">Failed to search location. Please try again.</p>
            </div>
          </div>
        )}

        {/* No Results */}
        {showResults && results.length === 0 && query && !isLoading && (
          <div className="absolute top-full mt-2 w-full panel animate-fadeIn">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500">No results found</p>
            </div>
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
