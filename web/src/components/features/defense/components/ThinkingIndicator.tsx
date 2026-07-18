'use client'

import { useReducedMotion } from '@mantine/hooks'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ThinkingIndicator}.
 */
type ThinkingIndicatorProps = {
  /** The examiner-voiced status line. */
  label: string
}

/** Number of animated pips trailing the thinking line. */
const PIP_COUNT = 3

/**
 * Shown in the transcript while the examiner "thinks" about the latest turn: a voiced line plus a row
 * of pulsing pips. Honors reduced-motion by holding the pips still. The enclosing transcript is the
 * live region that announces this line, so the indicator adds no live-region role of its own.
 */
export function ThinkingIndicator({ label }: ThinkingIndicatorProps) {
  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  return (
    <div className="flex items-center gap-3 pl-4 text-sm italic text-muted">
      {/* The examiner-voiced status line */}
      <span>{label}</span>

      {/* The breathing pips, held still under reduced-motion */}
      <span className="flex gap-1" aria-hidden="true">
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
      </span>
    </div>
  )
}
