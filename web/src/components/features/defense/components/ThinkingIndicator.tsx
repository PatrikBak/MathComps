'use client'

import { useInterval, useReducedMotion } from '@mantine/hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ThinkingIndicator}.
 */
type ThinkingIndicatorProps = {
  /** The examiner-voiced status line. */
  label: string
  /** The status line explaining a long wait. */
  longLabel: string
}

/** Number of animated pips closing the thinking line as its ellipsis. */
const PIP_COUNT = 3

/** Seconds of waiting after which the status line explains the wait. */
const LONG_WAIT_THRESHOLD_SECONDS = 10

/**
 * Formats a second count as a `m:ss` stopwatch reading.
 *
 * @param seconds - The elapsed second count.
 *
 * @returns The `m:ss` reading.
 */
function formatElapsed(seconds: number): string {
  // The stopwatch reading
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * Shown in the transcript while the examiner "thinks" about the latest turn: a voiced line, a
 * parenthesized ticking stopwatch, and pulsing pips standing in for the line's ellipsis. Once the
 * wait runs long, the line crossfades to one explaining the delay while the stopwatch and pips
 * glide to their new spot. Honors reduced-motion by holding the pips still and swapping without the
 * glide. The enclosing transcript is the live region that announces the line, so the indicator adds
 * no live-region role of its own; the stopwatch is hidden from it so each tick isn't announced.
 */
export function ThinkingIndicator({ label, longLabel }: ThinkingIndicatorProps) {
  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  // Seconds since the wait began; the component mounts with the request, so mount time is the start
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Tick the stopwatch once a second for the component's lifetime
  useInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000, { autoInvoke: true })

  // The line for the current wait length, explanatory once it runs long
  const activeLabel = elapsedSeconds >= LONG_WAIT_THRESHOLD_SECONDS ? longLabel : label

  return (
    <div className="relative flex items-center gap-2 pl-4 text-sm italic text-muted">
      {/* The examiner-voiced status line */}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={activeLabel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
        >
          {activeLabel}
        </motion.span>
      </AnimatePresence>

      {/* The elapsed stopwatch */}
      <motion.span
        layout={!reducedMotion}
        aria-hidden="true"
        className="text-xs not-italic tabular-nums"
      >
        ({formatElapsed(elapsedSeconds)})
      </motion.span>

      {/* The breathing pips */}
      <motion.span layout={!reducedMotion} className="flex gap-1" aria-hidden="true">
        {Array.from({ length: PIP_COUNT }, (_unused, index) => (
          <span
            key={index}
            className={cn(
              'size-1.5 rounded-full bg-brand',
              reducedMotion ? 'opacity-70' : 'animate-pulse'
            )}
            style={reducedMotion ? undefined : { animationDelay: `${index * 0.2}s` }}
          />
        ))}
      </motion.span>
    </div>
  )
}
