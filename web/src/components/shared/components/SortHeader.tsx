'use client'

import { ArrowDown, ArrowUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { nextSort, type TableSort } from '@/components/shared/utils/table-sort'

/**
 * Props for the {@link SortHeader} component.
 */
type SortHeaderProps<TColumn extends string> = {
  /** What the header reads. */
  label: ReactNode
  /** The column the header orders the rows by. */
  by: TColumn
  /** How the rows are ordered. */
  sort: TableSort<TColumn>
  /** Each column's starting direction, as {@link nextSort} takes it. */
  startsAscending: Readonly<Record<TColumn, boolean>>
  /** Orders the rows as a press on the header asks. */
  onSort: (sort: TableSort<TColumn>) => void
  /** Classes on the header cell. */
  className: string
  /** Whether the direction arrow hangs before the label, which a right-aligned column needs to keep it clear. */
  arrowBefore?: boolean
  /** What the header is called, where its label doesn't say it in words. */
  ariaLabel?: string
  /** Classes on the header's button, on top of its own. */
  buttonClassName?: string
}

/**
 * A column header cell which orders the rows, lit while it is the one ordering them, and telling assistive tech
 * which way they read. Its direction arrow hangs off the label so the label stays over its column. On a header not
 * ordering the rows the arrow is dimmed and points the way a press would order them.
 */
export function SortHeader<TColumn extends string>({
  label,
  by,
  sort,
  startsAscending,
  onSort,
  className,
  arrowBefore = false,
  ariaLabel,
  buttonClassName,
}: SortHeaderProps<TColumn>) {
  // Whether this header's column is the one ordering the rows
  const isActive = sort.by === by

  // The order a press on the header brings
  const next = nextSort(sort, by, startsAscending)

  // Which way the arrow points: the order standing, or the one a press would bring
  const ascending = isActive ? sort.ascending : next.ascending

  // Which way the rows read, told to assistive tech on the header ordering them
  const ariaSort = isActive ? (sort.ascending ? 'ascending' : 'descending') : undefined

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => onSort(next)}
        aria-pressed={isActive}
        className={cn(
          'relative uppercase tracking-wide transition-colors hover:text-foreground',
          isActive && 'text-foreground',
          FOCUS_RING_CLASS,
          buttonClassName
        )}
      >
        {label}
        <span
          className={cn(
            'absolute top-1/2 -translate-y-1/2',
            arrowBefore ? 'right-full mr-0.5' : 'left-full ml-0.5',
            !isActive && 'opacity-30'
          )}
        >
          {ascending ? (
            <ArrowUp size={11} strokeWidth={2.5} aria-hidden />
          ) : (
            <ArrowDown size={11} strokeWidth={2.5} aria-hidden />
          )}
        </span>
      </button>
    </th>
  )
}
