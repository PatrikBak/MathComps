'use client'

import { useReducedMotion } from '@mantine/hooks'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

/** Number of animated pips closing the thinking line as its ellipsis. */
const PIP_COUNT = 3

/**
 * Shown in the transcript while the examiner "thinks" about the latest turn: a voiced line and
 * pulsing pips standing in for the line's ellipsis. Honors reduced-motion by holding the pips still.
 * The enclosing transcript is the live region that announces the line, so the indicator adds no
 * live-region role of its own.
 */
export function ThinkingIndicator() {
  // Defense copy
  const t = useTranslations('defense')

  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  return (
    <div className="flex items-center gap-2 pl-4 text-sm italic text-muted">
      {/* The examiner-voiced status line */}
      <span>{t('thinking')}</span>

      {/* The breathing pips */}
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
