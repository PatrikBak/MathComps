import { useDisclosure } from '@mantine/hooks'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { ROOMY_VISIBLE } from './guide-filter-layout'
import { type FilterPillGroup } from './guide-filter-model'
import { GuideFilterSummary } from './GuideFilterSummary'

/**
 * Props for the {@link GuideFilterBar} component.
 */
type GuideFilterBarProps = {
  /** Filter dimensions to render. */
  groups: FilterPillGroup[]
}

/**
 * Props for the {@link FilterPill} component.
 */
type FilterPillProps = {
  /** Pill label. */
  label: string
  /** Whether this pill is the active selection. */
  active: boolean
  /** Click handler. */
  onClick: () => void
}

/**
 * A single rounded filter pill — hairline by default, brand-tinted when active.
 */
function FilterPill({ label, active, onClick }: FilterPillProps) {
  // Render the pill button
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
        active
          ? 'border-brand bg-brand/20 font-semibold text-foreground'
          : 'border-foreground/30 text-muted-foreground hover:border-muted hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

/**
 * Per-page contextual filter bar: a hairline panel of single-select pill rows, one row per dimension.
 * On a cramped viewport (a narrow or short screen) the rows collapse behind a toggle header to spare
 * vertical space; on a roomy viewport they stay open and the toggle is hidden.
 */
export function GuideFilterBar({ groups }: GuideFilterBarProps) {
  // Whether the pill grid is expanded on cramped screens
  const [opened, { toggle }] = useDisclosure(false)

  // The toggle header, then the (collapsible) pill grid
  return (
    <div className="mb-6 rounded-xl border border-foreground/10 bg-surface/30 px-4 py-3">
      {/* Cramped-screen header: toggle + active-selection chips (hidden when roomy) */}
      <GuideFilterSummary groups={groups} opened={opened} onToggle={toggle} />

      {/* One pill row per dimension — collapsed by default when cramped, always shown when roomy */}
      <div
        className={cn(
          'space-y-3 sm:space-y-2',
          // A hairline divider above the grid while it sits under the open toggle header (only ever
          // reachable on a cramped screen, so this never shows on a roomy one)
          opened && 'mt-3 border-t border-foreground/10 pt-3',
          opened ? 'block' : 'hidden',
          ROOMY_VISIBLE
        )}
      >
        {/* One row per filter dimension */}
        {groups.map((group) => (
          <div
            key={group.key}
            className="sm:grid sm:grid-cols-[4.6rem_1fr] sm:items-baseline sm:gap-x-2"
          >
            {/* Dimension label: a header above the pills on mobile, an inline left column from sm up */}
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted sm:mb-0 sm:text-sm sm:normal-case sm:tracking-normal">
              {group.label}
            </span>
            {/* Options (the first is the "all" reset) */}
            <div className="flex flex-wrap gap-2">
              {group.options.map((option) => (
                <FilterPill
                  key={option.value ?? 'all'}
                  label={option.label}
                  active={group.selected === option.value}
                  onClick={() => group.onSelect(option.value)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
