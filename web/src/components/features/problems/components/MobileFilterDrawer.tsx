'use client'

import { Transition } from '@headlessui/react'
import { useHotkeys } from '@mantine/hooks'
import { Filter, X } from 'lucide-react'
import React, { useEffect } from 'react'

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
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm"
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
          <div className="fixed left-0 top-0 h-full w-full max-w-[320px] sm:w-96 sm:max-w-[85vw] bg-slate-800 shadow-xl">
            {/* Spacer for main header */}
            <div className="h-14 sm:h-16 lg:h-20 bg-slate-900/50"></div>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-600/60 p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
                <h2 className="text-base sm:text-lg font-semibold text-gray-300">Filtre</h2>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-indigo-500 text-[10px] sm:text-xs font-medium text-white">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700/50 hover:text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Zavrieť filtre"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Filters Content */}
            <div className="h-[calc(100vh-8.5rem)] sm:h-[calc(100vh-9.5rem)] lg:h-[calc(100vh-11rem)] overflow-y-auto">
              {/* Mobile-optimized filters wrapper - override fixed positioning */}
              <div className="mobile-filter-wrapper">
                <SearchFilters
                  filters={filters}
                  onFiltersChange={onFiltersChange}
                  filterOptions={filterOptions}
                  baseOptions={baseOptions}
                />
              </div>
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
  return (
    <button
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-600/60 bg-slate-800/90 px-3 py-2 text-sm font-medium text-slate-300 shadow-sm hover:bg-slate-700/90 hover:text-slate-200 focus:outline-none active:scale-[0.98] transition-transform"
      aria-label={`Otvoriť filtre${activeFilterCount > 0 ? ` (${activeFilterCount} aktívnych)` : ''}`}
    >
      <Filter className="h-4 w-4 flex-shrink-0" />
      <span className="hidden min-[350px]:inline">Filtre</span>
      {activeFilterCount > 0 && (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500 text-xs font-medium text-white flex-shrink-0">
          {activeFilterCount}
        </span>
      )}
    </button>
  )
}
