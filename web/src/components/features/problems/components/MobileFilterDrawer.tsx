'use client'

import { Transition } from '@headlessui/react'
import { useHotkeys } from '@mantine/hooks'
import { Filter, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/shared/components/Button'

import type { FilterOptionsWithCounts, SearchFiltersState } from '../types/problem-library-types'
import { SearchFilters } from './SearchFilters'

type MobileFilterDrawerProps = {
  isOpen: boolean
  onClose: () => void
  filters: SearchFiltersState
  onFiltersChange: (newFilters: SearchFiltersState, type: 'discrete' | 'text') => void
  filterOptions: FilterOptionsWithCounts
  baseOptions: FilterOptionsWithCounts
  activeFilterCount: number
  /** When filtering by a shared list, the display name of that list. Null otherwise. */
  sharedListName?: string | null
}

/**
 * Mobile-friendly filter drawer that slides out from the left side.
 * Contains the full SearchFilters component in a mobile-optimized layout.
 *
 * Features:
 * - Smooth slide animation from left
 * - Backdrop overlay with blur effect
 * - Escape key and backdrop click to close
 * - Prevents background scrolling when open
 * - Full-height layout optimized for mobile screens
 */
export const MobileFilterDrawer = ({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  filterOptions,
  baseOptions,
  activeFilterCount,
  sharedListName,
}: MobileFilterDrawerProps) => {
  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    // Cleanup on unmount
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle escape key to close drawer
  useHotkeys([['Escape', onClose]], [], isOpen)

  // Translations
  const tFilters = useTranslations('ui.filters')

  return (
    <Transition show={isOpen} unmount={false}>
      <div className="fixed inset-0 z-50 lg:hidden">
        {/* Backdrop */}
        <Transition.Child
          unmount={false}
          enter="transition-opacity ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div
            className="fixed inset-0 bg-surface/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
        </Transition.Child>

        {/* Drawer Panel */}
        <Transition.Child
          unmount={false}
          enter="transition-transform ease-out duration-200"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="transition-transform ease-in-out duration-200"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <div className="fixed left-0 top-0 h-full w-full max-w-[320px] sm:w-96 sm:max-w-[85vw] bg-surface shadow-xl flex flex-col">
            {/* Spacer for main header */}
            <div className="h-14 sm:h-16 lg:h-20 bg-surface/50 flex-shrink-0"></div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-foreground/10 p-3 sm:p-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-muted" />
                <h2 className="text-base sm:text-lg font-semibold text-muted-foreground">
                  {tFilters('title')}
                </h2>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-focus text-[10px] sm:text-xs font-medium text-focus-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md text-muted hover:bg-foreground/5 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                aria-label={tFilters('close')}
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Filters Content */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Mobile-optimized filters wrapper - override fixed positioning */}
              <div className="mobile-filter-wrapper">
                <SearchFilters
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  filterOptions={filterOptions}
                  baseOptions={baseOptions}
                  sharedListName={sharedListName}
                />
              </div>
            </div>

            {/* Apply Filters Footer */}
            <div className="flex-shrink-0 border-t border-foreground/10 p-3 sm:p-4 bg-surface">
              <Button variant="primary" fullWidth onClick={onClose}>
                {tFilters('apply')}
              </Button>
            </div>
          </div>
        </Transition.Child>
      </div>
    </Transition>
  )
}

/**
 * Mobile filter trigger button with filter count indicator.
 * Shows prominently when sidebar is not visible (mobile screens).
 */
type MobileFilterButtonProps = {
  onClick: () => void
  activeFilterCount: number
}

export const MobileFilterButton = ({ onClick, activeFilterCount }: MobileFilterButtonProps) => {
  // Get translations
  const tFilters = useTranslations('ui.filters')

  // Render the button
  return (
    <Button
      variant="secondary"
      size="sm"
      className="rounded-md px-2 min-[400px]:px-2.5"
      onClick={onClick}
      aria-label={
        activeFilterCount > 0
          ? tFilters('openWithCount', { count: activeFilterCount })
          : tFilters('open')
      }
    >
      {/* Funnel icon */}
      <Filter className="h-4 w-4 flex-shrink-0" />
      {/* Label appears once there's room */}
      <span className="hidden min-[500px]:inline">{tFilters('title')}</span>
      {/* Active-filter count pill */}
      {activeFilterCount > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-focus text-xs font-medium text-focus-foreground flex-shrink-0">
          {activeFilterCount}
        </span>
      )}
    </Button>
  )
}
