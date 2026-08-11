/**
 * Writes how long something took, at the scale the span falls in: milliseconds while it is one, seconds to a
 * tenth once it passes one, and minutes and seconds once it passes one of those.
 *
 * @param durationMs - The span, in milliseconds.
 *
 * @returns The span, as a short label.
 */
export function formatDurationMs(durationMs: number): string {
  // Under a second, the whole figure fits in milliseconds
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`
  }

  // Under a minute, a tenth of a second is the resolution worth reading
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)} s`
  }

  // Past a minute, whole minutes and the seconds left over
  const minutes = Math.floor(durationMs / 60_000)
  const seconds = Math.round((durationMs % 60_000) / 1000)

  // The leftover seconds can round up to a whole minute, which reads as "1 m 60 s" unless it's carried
  return seconds === 60 ? `${minutes + 1} m 0 s` : `${minutes} m ${seconds} s`
}
