'use client'

import { ChevronDown, Menu } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import {
  TOC_CONTAINER_STYLES,
  TOC_LINK_ACTIVE_STYLES,
  TOC_LINK_BASE_STYLES,
  TOC_LINK_INACTIVE_STYLES,
} from './table-of-contents-styles'
import type { TableOfContentsProps } from './table-of-contents-types'
import { useTableOfContentsNavigation } from './useTableOfContentsNavigation'

/**
 * Mobile table of contents that shows as a fixed bottom bar with collapsible menu.
 * Displays the currently active section and uses scroll-spy to track position.
 *
 * Features:
 * - Backdrop overlay with blur effect when menu is open
 * - Click outside to close menu
 * - Smooth scroll navigation with history updates
 * - Active section highlighting in the dropdown menu
 * - Auto-scrolls to active item when menu opens
 * - Scrollable dropdown when content exceeds viewport height
 */
export function MobileTableOfContents({ items }: TableOfContentsProps) {
  // Track if the navigation is open
  const [isOpen, setIsOpen] = useState(false)

  // Reference to the active item button for auto-scrolling when menu opens
  const activeItemReference = useRef<HTMLButtonElement>(null)

  // Use shared navigation hook without hash change listener (mobile doesn't need it)
  const { activeIndex, handleNavigationClick: baseNavigationClick } = useTableOfContentsNavigation({
    items,
    enableHashChangeListener: false,
  })

  // Auto-scroll to active item when menu opens
  useEffect(() => {
    if (isOpen && activeItemReference.current) {
      // Scroll the active item into view with smooth behavior and center alignment
      activeItemReference.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [isOpen])

  // Early return if no items to avoid useScrollSpy with empty selector
  if (!items || items.length === 0) {
    return null
  }

  /**
   * Wraps the base navigation click handler to also close the mobile menu.
   *
   * @param id - The section ID to navigate to
   */
  const handleNavigationClick = (id: string) => {
    baseNavigationClick(id)
    // Close menu after successful navigation
    setIsOpen(false)
  }

  return (
    <>
      {/* Backdrop overlay - only visible when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="bg-slate-900/95 backdrop-blur-md border-t border-white/10">
          <div className="px-4 py-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                TOC_CONTAINER_STYLES,
                'flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/10'
              )}
            >
              <div className="flex items-center gap-3">
                <Menu className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-white">
                  {isOpen ? (
                    'Zavrieť'
                  ) : activeIndex !== undefined && items[activeIndex] ? (
                    <>
                      <span className="mr-1">{items[activeIndex].label}</span>
                      {items[activeIndex].title}
                    </>
                  ) : (
                    'Navigácia'
                  )}
                </span>
              </div>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-gray-400 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {isOpen && (
              <div className={cn(TOC_CONTAINER_STYLES, 'mt-3 p-2 max-h-[60vh] overflow-y-auto')}>
                <nav className="space-y-1">
                  {items.map((item, index) => (
                    <button
                      key={item.id}
                      ref={activeIndex === index ? activeItemReference : null}
                      onClick={() => handleNavigationClick(item.id)}
                      style={{ paddingLeft: `${0.75 + (item.level - 1) * 0.75}rem` }}
                      className={cn(TOC_LINK_BASE_STYLES, 'w-full py-2 text-left', {
                        [TOC_LINK_ACTIVE_STYLES]: activeIndex === index,
                        'font-medium': activeIndex === index,
                        [TOC_LINK_INACTIVE_STYLES]: activeIndex !== index,
                      })}
                    >
                      <span className="mr-2">{item.label}</span>
                      {item.title}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// #endregion
