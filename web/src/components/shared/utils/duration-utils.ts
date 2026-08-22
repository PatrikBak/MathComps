import { DAY_SECONDS, HOUR_SECONDS, MINUTE_MS, MINUTE_SECONDS, SECOND_MS } from './time-units'

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
  if (durationMs < SECOND_MS) {
    return `${Math.round(durationMs)} ms`
  }

  // Under a minute, a tenth of a second is the resolution worth reading
  if (durationMs < MINUTE_MS) {
    return `${(durationMs / SECOND_MS).toFixed(1)} s`
  }

  // Past a minute, whole minutes and the seconds left over
  const minutes = Math.floor(durationMs / MINUTE_MS)
  const seconds = Math.round((durationMs % MINUTE_MS) / SECOND_MS)

  // The leftover seconds can round up to a whole minute, which reads as "1 m 60 s" unless it's carried
  return seconds === MINUTE_SECONDS ? `${minutes + 1} m 0 s` : `${minutes} m ${seconds} s`
}

/**
 * A span of time broken into the fields a deadline is read in.
 */
export type DurationFields = {
  /** Whole days left. */
  days: number
  /** Whole hours left over after the days. */
  hours: number
  /** Whole minutes left over after the hours. */
  minutes: number
  /** Whole seconds left over after the minutes. */
  seconds: number
}

/**
 * Breaks a span into days, hours, minutes and seconds, truncating rather than rounding so no field ever
 * shows time the reader no longer has, and stopping at zero rather than going negative.
 *
 * The fields rather than a written span, so the caller words whichever pair its own scale calls for.
 *
 * @param remainingMs - How much time is left, in milliseconds.
 *
 * @returns The span's fields.
 */
export function splitRemaining(remainingMs: number): DurationFields {
  // Whole seconds left, floored so a part-second never rounds up into one
  const totalSeconds = Math.max(0, Math.floor(remainingMs / SECOND_MS))

  // Each field is what is left over after the larger ones have taken their share
  return {
    days: Math.floor(totalSeconds / DAY_SECONDS),
    hours: Math.floor((totalSeconds % DAY_SECONDS) / HOUR_SECONDS),
    minutes: Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS),
    seconds: totalSeconds % MINUTE_SECONDS,
  }
}

/**
 * Writes how much time is left as a clock reads it: `1:23:45` while an hour is left, `23:45` once one is
 * not. Seconds are truncated rather than rounded, so the figure never shows a second the reader no longer
 * has, and it stops at zero rather than going negative.
 *
 * @param remainingMs - How much time is left, in milliseconds.
 *
 * @returns The time left, as a clock.
 */
export function formatClockRemaining(remainingMs: number): string {
  // Whole seconds left, floored so a part-second never rounds up into one
  const totalSeconds = Math.max(0, Math.floor(remainingMs / SECOND_MS))

  // The three fields a clock is read in
  const hours = Math.floor(totalSeconds / HOUR_SECONDS)
  const minutes = Math.floor((totalSeconds % HOUR_SECONDS) / MINUTE_SECONDS)
  const seconds = totalSeconds % MINUTE_SECONDS

  // Under an hour, the hour field would only be a zero taking up room
  if (hours === 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  // Past an hour, minutes are padded too so the fields keep their places as the clock runs down
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
