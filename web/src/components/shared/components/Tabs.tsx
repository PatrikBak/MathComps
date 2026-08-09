import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'

import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * One tab and what it reveals.
 */
type TabItem<TId extends string> = {
  /** Stable identity of the tab, distinct within one group. */
  id: TId
  /** How the tab reads. */
  label: string
  /** A count shown after the label; null when the tab carries none. */
  count: number | null
  /** What the tab reveals. */
  panel: React.ReactNode
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
}

/**
 * A strip of tabs over the panel the selected one reveals.
 *
 * Selection is by id rather than by position, so a caller can swap what the panels are showing while leaving
 * the reader on the tab they picked. It contributes layout only: the panel owns its own padding and scrolling,
 * since a panel holding a region that scrolls itself would fight anything imposed from here. Panels stay
 * mounted while hidden, so one holding a scroll position or a half-written form is where it was left when it
 * comes back.
 */
export function Tabs<TId extends string>({
  items,
  selectedId,
  onSelect,
  ariaLabel,
}: TabsProps<TId>) {
  // Where the selected tab sits, falling back to the first for an id the strip doesn't hold
  const selectedIndex = Math.max(
    items.findIndex((item) => item.id === selectedId),
    0
  )

  return (
    <TabGroup
      selectedIndex={selectedIndex}
      onChange={(index) => onSelect(items[index].id)}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* The strip itself, which scrolls sideways rather than wrapping when the tabs outgrow it */}
      <TabList
        aria-label={ariaLabel}
        className={cn(
          'flex shrink-0 gap-1 overflow-x-auto border-b border-foreground/10 px-2',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {items.map((item) => (
          <Tab
            key={item.id}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-t-md px-3 py-2 text-sm',
              'border-b-2 border-transparent transition-colors',
              'text-muted hover:text-foreground',
              'data-selected:border-foreground data-selected:font-semibold data-selected:text-foreground',
              // The strip scrolls sideways, so the ring has to stay inside the tab to survive the clip
              FOCUS_RING_INSET_CLASS
            )}
          >
            {/* The tab's name */}
            {item.label}

            {/* And what it holds, where it counts */}
            {item.count !== null && <span className="text-xs text-muted">{item.count}</span>}
          </Tab>
        ))}
      </TabList>

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
