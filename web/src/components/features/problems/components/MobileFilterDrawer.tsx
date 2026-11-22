'use client'

import { Filter } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { TopSheet } from '@/components/shared/components/TopSheet'

import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { FilterMark } from './FilterMark'
import { SearchFilters } from './SearchFilters'

/**
 * The props of {@link MobileFilterDrawer}.
 */
type MobileFilterDrawerProps = {
  /** Whether the drawer is showing. */
  isOpen: boolean
  /** Dismisses the drawer. */
  onClose: () => void
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Applies a change the user made inside the drawer. */
  onFiltersChange: (newFilters: SearchFiltersState) => void
  /** Option counts under the current filters. */
  filterOptions: FilterOptionsWithCounts
  /** Option counts before any filtering. */
  baseOptions: FilterOptionsWithCounts
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName: string | null
}

/**
 * The filter sidebar as a sheet sliding down from the top, for viewports too narrow to keep it beside the results.
 *
 * Its contents stay mounted while it is closed, so a half-built filter survives being dismissed and reopened.
 */
export const MobileFilterDrawer = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
  sharedListName,
}: MobileFilterDrawerProps) => {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <TopSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <h2 className="flex items-center gap-2 text-lg font-semibold text-muted-foreground">
          <Filter className="h-4 w-4 text-muted" aria-hidden="true" />
          {tFilters('title')}
        </h2>
      }
      closeLabel={tFilters('close')}
      keepsContentMounted
      footer={
        <Button variant="primary" fullWidth onClick={onClose}>
          {tFilters('apply')}
        </Button>
      }
    >
      {/* Filters, padded in line with the sheet's header beyond their own padding */}
      <div className="px-3 sm:px-2">
        <SearchFilters
          filters={filters}
          onFiltersChange={onFiltersChange}
          filterOptions={filterOptions}
          baseOptions={baseOptions}
          sharedListName={sharedListName}
          onListPicked={onClose}
          // The filters stand on the sheet's own fill
          standsOn="card"
        />
      </div>
    </TopSheet>
  )
}

/**
 * The props of {@link MobileFilterButton}.
 */
type MobileFilterButtonProps = {
  /** Opens the drawer. */
  onClick: () => void
  /** How many filters are set. */
  activeFilterCount: number
}

/**
 * The button that opens {@link MobileFilterDrawer}, standing in for the sidebar on
 * viewports that have no room for it.
 */
export const MobileFilterButton = ({ onClick, activeFilterCount }: MobileFilterButtonProps) => {
  // Translations for the shared filter controls
  const tFilters = useTranslations('ui.filters')

  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 rounded-md px-2"
      onClick={onClick}
      aria-label={
        activeFilterCount > 0
          ? tFilters('openWithCount', { count: activeFilterCount })
          : tFilters('open')
      }
    >
      {/* Funnel and how many filters are set, which the button's accessible name speaks for */}
      <FilterMark count={activeFilterCount} />
    </Button>
  )
}
