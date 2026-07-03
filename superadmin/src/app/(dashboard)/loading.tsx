import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 animate-fade-in p-1">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="space-y-2">
          <Skeleton variant="text" className="h-8 w-48" />
          <Skeleton variant="text" className="h-4 w-64" />
        </div>
        <Skeleton variant="text" className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="card" className="h-32 w-full" style={{ animationDelay: `${i * 50}ms` }} />
        ))}
      </div>
      
      <Skeleton variant="card" className="h-[300px] w-full" style={{ animationDelay: '200ms' }} />
    </div>
  );
}
