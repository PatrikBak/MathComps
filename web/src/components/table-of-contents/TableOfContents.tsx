'use client'

import React, { useEffect, useRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import {
  TOC_CONTAINER_STYLES,
  TOC_LINK_ACTIVE_STYLES,
  TOC_LINK_BASE_STYLES,
  TOC_LINK_INACTIVE_STYLES,
} from './table-of-contents-styles'
import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents-types'
import { useTableOfContentsNavigation } from './useTableOfContentsNavigation'

// #region Types

/**
 * Props for the TocLinks presentational component.
 */
interface TocLinksProps {
  /** Array of table of contents items to render */
  items: TableOfContentsItem[]
  /** Index of the currently active item (highlighted) */
  activeIndex: number | undefined
  /** Callback invoked when a TOC link is clicked */
  onItemClick: (id: string) => void
  /** Ref registrar to allow auto-scrolling the active link into view */
  registerLinkElementRef: (index: number) => (element: HTMLAnchorElement | null) => void
}

// #endregion

// #region UI components

/**
 * Presentational list of table-of-contents links.
 * Indentation scales with level: each level adds 1rem (16px) of left margin.
 *
 * @param items - Array of TOC items to render
 * @param activeIndex - Index of the currently active item for highlighting
 * @param onItemClick - Callback for handling link clicks
 * @returns Rendered list of navigation links
 */
function TocLinks({ items, activeIndex, onItemClick, registerLinkElementRef }: TocLinksProps) {
  return (
    <ul className="space-y-1 -mx-4">
      {items.map((item, index) => (
        <li key={item.id}>
          <a
            ref={registerLinkElementRef(index)}
            href={`#${item.id}`}
            onClick={(event) => {
              event.preventDefault()
              onItemClick(item.id)
            }}
            className={cn(TOC_LINK_BASE_STYLES, 'py-1 duration-150 ease-in-out', {
              [TOC_LINK_ACTIVE_STYLES]: activeIndex === index,
              [TOC_LINK_INACTIVE_STYLES]: activeIndex !== index,
            })}
            style={{
              paddingLeft: `${(item.level - 1) * 1 + 1}rem`,
              paddingRight: '1rem',
            }}
          >
            <span className="mr-1">{item.label}</span>
            {item.title}
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Table of contents with scroll-spy highlighting and deep-link support.
 * Desktop-only component that displays as a fixed sidebar on large screens.
 *
 * Features:
 * - Scroll-spy tracking of active section
 * - Deep-link support via URL hash
 * - Smooth scroll navigation with header offset
 * - Automatic highlighting of current section
 *
 * @param items - Array of navigation items to display
 * @returns Desktop TOC sidebar or null if no items
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  // Use shared navigation hook with hash change listening enabled
  const { activeIndex, handleNavigationClick } = useTableOfContentsNavigation({
    items,
    enableHashChangeListener: true,
  })

  // Store references to the container and individual link elements so we can keep
  // the active link visible inside the sidebar when the main page scrolls.
  const containerRef = useRef<HTMLDivElement | null>(null)
  const linkElementRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const registerLinkElementRef = (index: number) => (element: HTMLAnchorElement | null) => {
    linkElementRefs.current[index] = element
  }

  // When the active link changes due to scroll-spy, scroll it into view if needed.
  // Special case: first item scrolls the entire container to top for a clean reset.
  useEffect(() => {
    if (activeIndex == null) return
    const containerElement = containerRef.current
    const activeElement = linkElementRefs.current[activeIndex]
    if (!containerElement || !activeElement) return

    // Scroll the container itself to the top for the first item
    if (activeIndex === 0) {
      containerElement.scrollTo({
        top: 0,
        behavior: 'smooth',
      })
    } else {
      // For other items, use smart nearest positioning
      activeElement.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      })
    }
  }, [activeIndex])

  // Early return if no items to avoid useScrollSpy with empty selector
  if (!items || items.length === 0) {
    return null
  }

  return (
    <>
      <div className="hidden lg:block lg:sticky lg:top-24">
        <div
          ref={containerRef}
          className={cn(
            TOC_CONTAINER_STYLES,
            'rounded-xl p-4 font-variant-numeric-tabular-nums hyphens-none leading-[1.35] text-[0.95rem] max-h-[80vh] overflow-y-auto'
          )}
        >
          <h3 className="text-sm font-semibold text-gray-200">Obsah</h3>
          <nav className="text-sm mt-2">
            <TocLinks
              items={items}
              activeIndex={activeIndex}
              onItemClick={handleNavigationClick}
              registerLinkElementRef={registerLinkElementRef}
            />
          </nav>
        </div>
      </div>
    </>
  )
}

// #endregion
