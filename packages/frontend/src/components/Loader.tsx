'use client';

interface LoaderProps {
  message?: string;
}

export default function Loader({ message = 'Loading...' }: LoaderProps) {
  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] panel px-6 py-4 animate-fadeIn">
      <div className="flex items-center gap-4">
        {/* Spinner */}
        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>

        {/* Message */}
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900">{message}</span>
          <span className="text-xs text-gray-600">This may take a few moments...</span>
        </div>
      </div>

      {/* Progress bar animation */}
      <div className="mt-4 w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 rounded-full animate-progress"></div>
      </div>
    </div>
  );
}
