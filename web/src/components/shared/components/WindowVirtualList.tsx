'use client'

import { createContext, type ReactNode, type RefObject, use, useLayoutEffect } from 'react'
import { type ContextProp, type ItemProps, Virtuoso } from 'react-virtuoso'

import { useFocusHandOff } from '@/hooks/use-focus-hand-off'

/** How far past the window's edges items are drawn, in pixels, so a scroll finds them ready. */
const ITEMS_DRAWN_BEYOND = { top: 800, bottom: 1200 } as const

/**
 * The keys of the items a {@link WindowVirtualList} holds now, which reach its items even while its drawing lags
 * behind.
 */
const HeldKeysContext = createContext<ReadonlySet<string>>(new Set())

/**
 * What every item's place in {@link WindowVirtualList} reaches through the list.
 */
type WindowVirtualListContext<TItem> = {
  /** What takes the focus when an item leaves holding it with none in its place. */
  fallbackRef: RefObject<HTMLElement | null>
  /** What tells one item from another across renders. */
  keyOf: (item: TItem) => string
}

/**
 * Props for the {@link WindowVirtualList} component.
 */
type WindowVirtualListProps<TItem> = WindowVirtualListContext<TItem> & {
  /** The items, in the order they show. */
  items: readonly TItem[]
  /** Draws one item. */
  renderItem: (item: TItem) => ReactNode
}

/**
 * A list scrolled by the page itself, only the items in or near the window drawn, for items that take a while to draw
 * all at once. Find in page sees only the items drawn, and the page scrolls at once rather than smoothly while the
 * list is on screen. The list draws a change only while it is on screen, so an item it lost while out of sight is
 * hidden as it comes back, and nothing on the page finds it in the moment the drawing takes to catch up.
 */
export function WindowVirtualList<TItem>({
  items,
  keyOf,
  renderItem,
  fallbackRef,
}: WindowVirtualListProps<TItem>) {
  // The keys of the items held now
  const heldKeys = new Set(items.map(keyOf))

  // The page scrolling at once while the list is on screen, since Virtuoso keeps what is in view in place by
  // scrolling the page as items above it are measured, and a smooth scroll turns each such step into a visible jump
  useLayoutEffect(() => {
    // The page's root, which carries how the page scrolls
    const root = document.documentElement

    // Scrolling at once
    root.style.scrollBehavior = 'auto'

    // Back to the site's own scrolling once the list leaves the screen
    return () => {
      root.style.removeProperty('scroll-behavior')
    }
  }, [])

  return (
    // The items in or near the window, the page scrolling them, each knowing whether the list still holds it
    <HeldKeysContext value={heldKeys}>
      <Virtuoso<TItem, WindowVirtualListContext<TItem>>
        useWindowScroll
        data={items}
        context={{ fallbackRef, keyOf }}
        components={{ Item: WindowVirtualListItem }}
        increaseViewportBy={ITEMS_DRAWN_BEYOND}
        computeItemKey={(_index, item) => keyOf(item)}
        itemContent={(_index, item) => renderItem(item)}
      />
    </HeldKeysContext>
  )
}

/**
 * One item's place in {@link WindowVirtualList}, spaced from the next, and hidden once the list no longer holds its
 * item. An item leaving the page while it holds the focus, gone from the list or scrolled far out of the window, hands
 * it on as {@link useFocusHandOff} does, among the places of the items still drawn.
 */
function WindowVirtualListItem<TItem>({
  children,
  context,
  item,
  ...placement
}: ItemProps<TItem> & ContextProp<WindowVirtualListContext<TItem>>) {
  // The keys of the items the list holds now
  const heldKeys = use(HeldKeysContext)

  // The focus handed on as the item leaves the page holding it
  const handOff = useFocusHandOff<HTMLDivElement>(context.fallbackRef)

  // The item where the list places it, out of sight once the list no longer holds it
  return (
    <div {...placement} {...handOff} hidden={!heldKeys.has(context.keyOf(item))} className="pb-4">
      {children}
    </div>
  )
}
