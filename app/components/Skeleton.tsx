export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-800/50 rounded ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="border border-slate-800 rounded-xl p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}
