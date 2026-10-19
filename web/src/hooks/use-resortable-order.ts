'use client'

import { useState } from 'react'

import { useFirstSeenOrder } from './use-first-seen-order'

/**
 * Options for {@link useResortableOrder}.
 */
type UseResortableOrderOptions<TItem> = {
  /** The items, in the order they come in now. */
  items: readonly TItem[]
  /** What tells one item from another across renders. */
  keyOf: (item: TItem) => string
  /** A value whose change sets the order again, as asking for it does. */
  resetKey: string
}

/**
 * What {@link useResortableOrder} hands back.
 */
type UseResortableOrderResult<TItem> = {
  /** The items, each where it stood when the order was last set. */
  shown: TItem[]
  /** Whether the items come in in an order other than the one shown. */
  isOutOfOrder: boolean
  /** Sets the order again, to the one the items come in. */
  resort: () => void
}

/**
 * A list whose order is set at chosen moments and kept in between, so nothing moves while the reader works: as it
 * mounts, as the reset key changes, and when the reader asks. An item that comes in since goes where the order it
 * comes in puts it.
 *
 * @param options - {@link UseResortableOrderOptions}.
 *
 * @returns The items as they show, whether their order is out of date, and the way to set it again.
 */
export function useResortableOrder<TItem>({
  items,
  keyOf,
  resetKey,
}: UseResortableOrderOptions<TItem>): UseResortableOrderResult<TItem> {
  // How many times the reader has asked for the order to be set again
  const [sortings, setSortings] = useState(0)

  // The items, each kept where it stood when the order was last set
  const shown = useFirstSeenOrder({
    items,
    keyOf,
    resetKey: JSON.stringify([resetKey, sortings]),
    newcomerPlace: 'inPlace',
  })

  // Whether any item stands elsewhere than the order it comes in would put it
  const isOutOfOrder = shown.some((item, index) => item !== items[index])

  // A function which sets the order again
  const resort = () => setSortings((count) => count + 1)

  // The items as they show, whether their order is out of date, and the way to set it again
  return { shown, isOutOfOrder, resort }
}
