'use client';

import { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface SearchResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    country?: string;
  };
}

export default function LocationSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const map = useMap();
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const searchLocation = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsLoading(true);
    try {
      // Using Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=5`
      );
      const data = await response.json();
      setResults(data);
      setShowResults(true);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced search on input change
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (query.trim().length > 2) {
      debounceTimer.current = setTimeout(() => {
        searchLocation(query);
      }, 500); // 500ms debounce
    } else {
      setResults([]);
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
    if (query.trim()) {
      searchLocation(query);
    }
  };

  const handleSelectLocation = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    // Fly to the selected location
    map.flyTo([lat, lon], 15, {
      duration: 1.5,
    });

    setShowResults(false);
    setQuery(result.display_name);
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
                  {result.display_name}
                </div>
                {result.address && (
                  <div className="text-xs text-gray-500 mt-1">
                    {result.address.city && `${result.address.city}, `}
                    {result.address.country}
                  </div>
                )}
              </button>
            ))}
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
