'use client';

interface LoaderProps {
  message?: string;
}

export default function Loader({ message = 'Loading...' }: LoaderProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-white px-6 py-4 rounded-lg shadow-lg border border-blue-200">
      <div className="flex items-center gap-3">
        {/* Spinner */}
        <div className="relative w-8 h-8">
          <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>

        {/* Message */}
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{message}</span>
          <span className="text-xs text-gray-500">This may take a few moments...</span>
        </div>
      </div>

      {/* Progress bar animation */}
      <div className="mt-3 w-full h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 rounded-full animate-progress"></div>
      </div>
    </div>
  );
}
