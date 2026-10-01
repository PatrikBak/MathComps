import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useMergedRef } from '@mantine/hooks'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useScrollFade } from '@/hooks/use-scroll-fade'

/**
 * One tab and what it reveals.
 */
export type TabItem<TId extends string> = {
  /** Stable identity of the tab, distinct within one group. */
  id: TId
  /** How the tab reads. */
  label: string
  /** A count shown after the label; null when the tab carries none. */
  count: number | null
  /** What the tab reveals. */
  panel: React.ReactNode
  /** Whether the tab reads in the accent colour while another is showing. */
  isHighlighted?: boolean
}

/**
 * Props for the {@link Tabs} component.
 */
type TabsProps<TId extends string> = {
  /** The tabs, in the order they read. */
  items: readonly TabItem<TId>[]
  /** Which tab is showing, by its {@link TabItem.id}. */
  selectedId: TId
  /** Called with the id of the tab the reader moved to. */
  onSelect: (id: TId) => void
  /** Accessible name for the strip of tabs. */
  ariaLabel: string
  /** What sits at the strip's far end, outside the part that scrolls; undefined for nothing. */
  trailing?: ReactNode
}

/**
 * A strip of tabs over the panel the selected one reveals.
 *
 * Selection is by id rather than by position, so a caller can swap what the panels are showing while leaving
 * the reader on the tab they picked. It contributes layout only: the panel owns its own padding and scrolling,
 * since a panel holding a region that scrolls itself would fight anything imposed from here. Panels stay
 * mounted while hidden, so one holding a scroll position or a half-written form is where it was left when it
 * comes back. A strip too long for its width opens scrolled to the tab showing.
 */
export function Tabs<TId extends string>({
  items,
  selectedId,
  onSelect,
  ariaLabel,
  trailing,
}: TabsProps<TId>) {
  // Where the selected tab sits, falling back to the first for an id the strip doesn't hold
  const selectedIndex = Math.max(
    items.findIndex((item) => item.id === selectedId),
    0
  )

  // The strip, and the tab showing when it first drew
  const stripRef = useRef<HTMLDivElement>(null)
  const selectedTabRef = useRef<HTMLButtonElement>(null)

  // Whichever edge of the strip still hides tabs, faded so the strip reads as one that scrolls
  const { ref: fadeRef, maskStyle } = useScrollFade<HTMLDivElement>()

  // The strip, handed to every ref that reads it
  const setStrip = useMergedRef(stripRef, fadeRef)

  // Scroll the strip, once, so the tab showing sits in view, moving the strip alone and never the page
  useEffect(() => {
    // The strip and the selected tab, once drawn
    const strip = stripRef.current
    const tab = selectedTabRef.current

    // Centred where the strip overflows, and left alone where everything fits
    if (strip !== null && tab !== null && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = tab.offsetLeft - (strip.clientWidth - tab.clientWidth) / 2
    }
  }, [])

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={(index) => onSelect(items[index].id)}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* The strip and whatever sits at its end, over one rule */}
      <div className="flex shrink-0 items-center border-b border-foreground/10">
        {/* The strip itself, which scrolls sideways rather than wrapping when the tabs outgrow it */}
        <TabList
          ref={setStrip}
          aria-label={ariaLabel}
          style={maskStyle}
          className={cn(
            'relative flex min-w-0 flex-1 gap-0.5 overflow-x-auto px-1.5',
            'sm:gap-1 sm:px-2',
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {items.map((item, index) => (
            <Tab
              key={item.id}
              ref={index === selectedIndex ? selectedTabRef : undefined}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 py-2 text-[0.8125rem]',
                'sm:px-3 sm:text-sm',
                'border-b-2 border-transparent transition-colors',
                item.isHighlighted === true ? 'text-brand-light' : 'text-muted',
                'hover:text-foreground',
                'data-selected:border-foreground data-selected:font-semibold data-selected:text-foreground',
                // The ring keys on data-focus, which HeadlessUI sets for keyboard focus alone: a click focuses
                // the tab from code, and :focus-visible counts that as keyboard focus. It stays inside the
                // tab, the strip clipping anything drawn past its edges as it scrolls
                'focus:outline-none data-focus:ring-2 data-focus:ring-inset data-focus:ring-focus'
              )}
            >
              {/* The tab's name */}
              {item.label}

              {/* And what it holds, where it counts */}
              {item.count !== null && <span className="text-xs text-muted">{item.count}</span>}
            </Tab>
          ))}
        </TabList>

        {/* Whatever sits at the strip's end */}
        {trailing !== undefined && <div className="shrink-0 pl-2">{trailing}</div>}
      </div>

      {/* The panels, each free to lay itself out and to scroll on its own */}
      <TabPanels className="flex min-h-0 flex-1 flex-col">
        {items.map((item) => (
          <TabPanel key={item.id} unmount={false} className="flex min-h-0 flex-1 flex-col">
            {item.panel}
          </TabPanel>
        ))}
      </TabPanels>
    </TabGroup>
  )
}
