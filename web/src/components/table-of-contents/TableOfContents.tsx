'use client'

import { useRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import {
  TOC_CONTAINER_STYLES,
  TOC_LINK_ACTIVE_STYLES,
  TOC_LINK_BASE_STYLES,
  TOC_LINK_INACTIVE_STYLES,
} from './table-of-contents-styles'
import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents-types'
import { useTableOfContentsNavigation } from './use-table-of-contents-navigation'

/**
 * Props for the TocLinks presentational component.
 */
type TocLinksProps = {
  /** Array of table of contents items to render */
  items: TableOfContentsItem[]
  /** Index of the currently active item (highlighted) */
  activeIndex: number | undefined
  /** Callback invoked when a TOC link is clicked */
  onItemClick: (id: string) => void
  /** Ref registrar to allow auto-scrolling the active link into view */
  registerLinkElementRef: (index: number) => (element: HTMLAnchorElement | null) => void
}

/**
 * List of  table-of-contents links.
 */
function TocLinks({ items, activeIndex, onItemClick, registerLinkElementRef }: TocLinksProps) {
  return (
    <ul className="space-y-0">
      {items.map((item, index) => {
        // Calculate indentation based on level
        const indentPx = (item.level - 1) * 20

        return (
          <li key={item.id}>
            <a
              ref={registerLinkElementRef(index)}
              href={`#${item.id}`}
              onClick={(event) => {
                event.preventDefault()
                onItemClick(item.id)
              }}
              className={cn(TOC_LINK_BASE_STYLES, 'py-1.5 px-3 flex items-start gap-2', {
                [TOC_LINK_ACTIVE_STYLES]: activeIndex === index,
                [TOC_LINK_INACTIVE_STYLES]: activeIndex !== index,
              })}
              style={{
                marginLeft: `${indentPx}px`,
              }}
            >
              <span className="text-slate-500 text-xs font-mono shrink-0 min-w-[1.25rem] pt-0.5 text-right">
                {item.label}
              </span>
              <span className="leading-snug">{item.title}</span>
            </a>
          </li>
        )
      })}
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
 */
export function TableOfContents({ items }: TableOfContentsProps) {
  // Use shared navigation hook
  const { activeIndex, handleNavigationClick } = useTableOfContentsNavigation({
    items,
  })

  // Store references to the container and individual link elements so we can keep
  // the active link visible inside the sidebar when the main page scrolls.
  const containerRef = useRef<HTMLDivElement | null>(null)
  const linkElementRefs = useRef<(HTMLAnchorElement | null)[]>([])
  const registerLinkElementRef = (index: number) => (element: HTMLAnchorElement | null) => {
    linkElementRefs.current[index] = element
  }

  return (
    <>
      <div className="hidden lg:block lg:sticky lg:top-24">
        <div
          ref={containerRef}
          className={cn(
            TOC_CONTAINER_STYLES,
            'p-5 font-variant-numeric-tabular-nums hyphens-none leading-relaxed text-[0.95rem] max-h-[80vh] overflow-y-auto'
          )}
        >
          <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            Obsah
          </h3>
          <nav className="text-sm">
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
