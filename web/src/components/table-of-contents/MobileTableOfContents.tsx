'use client'

import { ChevronDown, Menu } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import {
  TOC_CONTAINER_STYLES,
  TOC_LINK_ACTIVE_STYLES,
  TOC_LINK_BASE_STYLES,
  TOC_LINK_INACTIVE_STYLES,
} from './table-of-contents-styles'
import type { TableOfContentsProps } from './table-of-contents-types'
import { useTableOfContentsNavigation } from './use-table-of-contents-navigation'

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
  // Translations for UI labels
  const t = useTranslations('navigation')

  // Track if the navigation is open
  const [isOpen, setIsOpen] = useState(false)

  // Reference to the active item button for auto-scrolling when menu opens
  const activeItemReference = useRef<HTMLButtonElement>(null)

  // Use shared navigation hook
  const { activeIndex, handleNavigationClick: baseNavigationClick } = useTableOfContentsNavigation({
    items,
  })

  // Auto-scroll to active item when menu opens
  useEffect(() => {
    if (isOpen && activeItemReference.current) {
      activeItemReference.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [isOpen])

  /**
   * Wraps the base navigation click handler to also close the mobile menu.
   *
   * @param id - The section ID to navigate to
   */
  const handleNavigationClick = (id: string) => {
    // Invoke base navigation click handler
    baseNavigationClick(id)
    // Close menu after successful navigation
    setIsOpen(false)
  }

  return (
    <>
      {/* Backdrop overlay - only visible when menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom navigation bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="bg-surface/95 backdrop-blur-md border-t border-foreground/10">
          <div className="px-4 py-3">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                TOC_CONTAINER_STYLES,
                'flex w-full items-center justify-between py-3 text-left transition-colors hover:bg-foreground/10',
                isOpen || activeIndex === undefined || !items[activeIndex] ? 'px-4' : 'pl-3 pr-4'
              )}
            >
              {isOpen || activeIndex === undefined || !items[activeIndex] ? (
                <div className="flex items-center gap-2.5">
                  <Menu className="h-4 w-4 text-muted shrink-0" />
                  <span className="text-sm font-medium text-foreground">
                    {isOpen ? t('menuClose') : t('menuOpen')}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 min-w-0">
                  <Menu className="h-4 w-4 text-muted shrink-0" />
                  <div className="flex items-start gap-2 text-sm min-w-0 flex-1">
                    <span className="text-muted text-xs font-mono shrink-0 min-w-[2rem] pt-0.5 flex items-center">
                      {items[activeIndex].icon ?? items[activeIndex].label}
                    </span>
                    <span className="font-medium text-foreground leading-snug line-clamp-1">
                      {items[activeIndex].title}
                    </span>
                  </div>
                </div>
              )}
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-muted transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {isOpen && (
              <div className={cn(TOC_CONTAINER_STYLES, 'mt-3 p-3 max-h-[60vh] overflow-y-auto')}>
                <nav className="space-y-0">
                  {items.map((item, index) => {
                    const indentPx = (item.level - 1) * 20

                    return (
                      <button
                        key={item.id}
                        ref={activeIndex === index ? activeItemReference : null}
                        onClick={() => handleNavigationClick(item.id)}
                        style={{ marginLeft: `${indentPx}px` }}
                        className={cn(
                          TOC_LINK_BASE_STYLES,
                          'w-full py-1.5 px-3 text-left flex items-start gap-2',
                          {
                            [TOC_LINK_ACTIVE_STYLES]: activeIndex === index,
                            [TOC_LINK_INACTIVE_STYLES]: activeIndex !== index,
                          }
                        )}
                      >
                        <span className="text-muted text-xs font-mono shrink-0 min-w-[1.25rem] pt-0.5 text-right flex items-center justify-end">
                          {item.icon ?? item.label}
                        </span>
                        <span className="text-left leading-snug">{item.title}</span>
                      </button>
                    )
                  })}
                </nav>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
