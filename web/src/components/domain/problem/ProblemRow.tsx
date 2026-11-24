'use client'

import type { LucideIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/** How a row under a problem is drawn, whatever it opens. */
export const PROBLEM_ROW_CLASS = cn(
  'flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5',
  FOCUS_RING_CLASS
)

/**
 * How many things a row under a problem leads to.
 */
type ProblemRowCount = {
  /** The number of things the row leads to. */
  value: number
  /** Whether some of those things are new to the reader. */
  hasNews?: boolean
}

/**
 * Props for the {@link ProblemRowLabel} component.
 */
type ProblemRowLabelProps = {
  /** What the row is called. */
  label: string
  /** The mark on the row, saying what kind of row it is. */
  icon: LucideIcon
  /** How many things the row leads to, said once there are any; null where the row counts nothing. */
  count: ProblemRowCount | null
}

/**
 * What a row under a problem says: its mark, its name, and how many things it leads to. While some of them are new to
 * the reader, the count is filled in and says so to a screen reader.
 */
export function ProblemRowLabel({ label, icon: Icon, count }: ProblemRowLabelProps) {
  // Content copy
  const tContent = useTranslations('ui.content')

  return (
    <span className="inline-flex items-center gap-2 text-foreground">
      {/* Mark */}
      <Icon size={15} className="text-muted" />
      {/* Name */}
      {label}
      {/* A space between the name and the count, so the row's accessible name reads them apart */}{' '}
      {/* Count, once there is anything to count */}
      {count !== null && count.value > 0 && (
        <span
          className={cn(
            'rounded-full px-1.5 text-xs font-semibold tabular-nums',
            count.hasNews ? 'bg-brand text-brand-foreground' : 'bg-brand/15 text-brand-light'
          )}
        >
          {count.value}
          {count.hasNews && <span className="sr-only">{tContent('includingNew')}</span>}
        </span>
      )}
    </span>
  )
}
