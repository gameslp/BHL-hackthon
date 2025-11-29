'use client';

import dynamic from 'next/dynamic';

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(
  () => import('@/features/map/components/Map'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-lg">Loading map...</div>
      </div>
    )
  }
);

export default function Home() {
  return (
    <main className="w-full h-screen">
      <Map />
    </main>
  );
}
