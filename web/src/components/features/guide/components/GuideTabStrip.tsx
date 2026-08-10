import { type Ref } from 'react'

import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

import { GUIDE_PAGES } from '../content/guide-content-types'
import { useGuideLabels } from '../content/guide-labels'
import { PAGE_ICONS } from '../content/guide-page-icons'
import { GuideSearch } from './GuideSearch'
import { useTabStripScroll } from './use-tab-strip-scroll'

/**
 * Props for the {@link GuideTabStrip} component.
 */
type GuideTabStripProps = {
  /** Index of the active deck page. */
  selectedIndex: number
  /** Steps the deck to a page index. */
  onSelect: (index: number) => void
  /** Whether the search palette is open. */
  paletteOpen: boolean
  /** Opens or closes the search palette. */
  onPaletteOpenChange: (open: boolean) => void
  /** Ref to the sticky bar's root element. */
  rootRef: Ref<HTMLDivElement>
}

/**
 * The deck's sticky page-tab bar: a single horizontal scroll strip on mobile — with a dynamic edge
 * fade that signals it's swipeable — wrapping into a plain row from `sm` up, plus the corner search
 * trigger.
 */
export function GuideTabStrip({
  selectedIndex,
  onSelect,
  paletteOpen,
  onPaletteOpenChange,
  rootRef,
}: GuideTabStripProps) {
  // Localized page names
  const labels = useGuideLabels()
  // The strip's scroll affordances: active-tab centering, the edge fade, and the first-view nudge
  const { scrollerRef, activeTabRef, maskStyle } = useTabStripScroll(selectedIndex)

  return (
    <div
      ref={rootRef}
      className="sticky top-[var(--header-height)] z-30 -mx-4 backdrop-blur sm:-mx-6 md:-mx-8"
    >
      <div className="flex items-center gap-2 px-4 py-2.5 sm:items-start sm:px-6 md:px-8">
        {/* The tab group: a single horizontal scroll strip on mobile, a wrapping row from sm up */}
        <div
          ref={scrollerRef}
          style={maskStyle}
          className="flex min-w-0 flex-1 gap-x-1.5 overflow-x-auto [scrollbar-width:none] sm:flex-wrap sm:gap-y-2 sm:overflow-visible [&::-webkit-scrollbar]:hidden"
        >
          {/* One tab per guide page */}
          {GUIDE_PAGES.map((page, index) => {
            // The tab's icon
            const Icon = PAGE_ICONS[page]
            // Whether it's the active tab
            const active = index === selectedIndex
            // The tab button
            return (
              <button
                key={page}
                ref={active ? activeTabRef : null}
                type="button"
                onClick={() => onSelect(index)}
                aria-current={active ? 'page' : undefined}
                // The strip is one stop rather than one per page: ◀/▶ already page the deck from
                // anywhere, so tabbing through every pill only puts distance between the reader and
                // whatever comes after the bar
                tabIndex={active ? 0 : -1}
                className={cn(
                  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                  // The strip scrolls sideways on a phone, so the ring has to stay inside the pill
                  FOCUS_RING_INSET_CLASS,
                  active
                    ? 'border-brand bg-brand/15 font-semibold text-foreground'
                    : 'border-foreground/15 text-muted hover:text-foreground'
                )}
              >
                <Icon size={16} />
                {labels.page[page]}
              </button>
            )
          })}
        </div>
        {/* Cross-page search: a quiet trigger pinned to the bar's corner + the ⌘K/"/" palette */}
        <GuideSearch isOpen={paletteOpen} onOpenChange={onPaletteOpenChange} />
      </div>
    </div>
  )
}
