'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

import type { UsePoolFiltersResult } from '../hooks/use-pool-filters'
import type { PoolCounts } from '../model/pool-filters'
import type { PoolViewMode } from '../model/selection-routes'
import { PoolFilterBar } from './PoolFilterBar'

/**
 * Props for the {@link PoolTools} component.
 */
type PoolToolsProps = {
  /** The layout of the pool the tools narrow. */
  mode: PoolViewMode
  /** What the pool is narrowed to, and the ways of changing it. */
  filters: UsePoolFiltersResult
  /** How much of what the layout lists stands beside each filter's option; null until it arrives. */
  counts: PoolCounts | null
}

/**
 * The search box over a layout of the pool and the row of filters under it, both setting the one filter every layout
 * shares.
 */
export function PoolTools({ mode, filters, counts }: PoolToolsProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  return (
    <div>
      {/* Search */}
      <label className="relative mt-4 block">
        <span className="sr-only">{t('search')}</span>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={filters.filter.query}
          onChange={(event) => filters.setField('query', event.target.value)}
          placeholder={t('searchPlaceholder')}
          // Drawn as light and as tall as the facet pills below, since it sits on the page itself
          className={cn(
            'form-input border-foreground/10 bg-foreground/[0.03] py-1.5 pl-9 placeholder:text-muted',
            'hover:border-foreground/25 hover:bg-foreground/[0.07] focus-visible:border-focus/70'
          )}
        />
      </label>

      {/* Narrowing the pool down */}
      <div className="mt-3">
        <PoolFilterBar mode={mode} filters={filters} counts={counts} />
      </div>
    </div>
  )
}
