'use client';

import dynamic from 'next/dynamic';

// Dynamically import Map component to avoid SSR issues with Leaflet
const Map = dynamic(
  () => import('@/features/map/components/Map'),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="w-full h-screen">
      <Map />
    </main>
  );
}
