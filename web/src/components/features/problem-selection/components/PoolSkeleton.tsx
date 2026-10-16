/**
 * Placeholder cards standing in for the pool while what it lists is on its way, hidden from a screen reader, which
 * the line over the pool tells instead.
 */
export function PoolSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {[0, 1, 2].map((index) => (
        <div key={index} className="h-48 animate-pulse rounded-xl bg-surface/25" />
      ))}
    </div>
  )
}
