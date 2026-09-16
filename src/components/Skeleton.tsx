/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Skeleton loading components with shimmer animation.
 * Uses the .skeleton CSS class defined in index.css.
 */

import React from 'react';

export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`skeleton h-4 ${className}`} />;
}

export function SkeletonCircle({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`skeleton rounded-full shrink-0 ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`glass-1 rounded-xl p-6 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <SkeletonLine className="w-1/3" />
        <SkeletonCircle size={32} />
      </div>
      <SkeletonLine className="w-1/2 h-8" />
      <SkeletonLine className="w-2/3" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="skeleton rounded-xl h-40 w-full" />
      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 skeleton rounded-xl h-64" />
        <div className="skeleton rounded-xl h-64" />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded-xl" />
      <div className="h-40 bg-slate-100 rounded-2xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-32 bg-slate-100 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
