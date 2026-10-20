'use client'

import { type RefObject, useState } from 'react'

import type { NewcomerPlace } from '@/components/shared/utils/first-seen-order'

import { useFirstSeenOrder } from './use-first-seen-order'
import { useShowFromTop } from './use-show-from-top'

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
  /** Where an item that comes in since the order was last set goes. */
  newcomerPlace: NewcomerPlace
  /** What takes the focus as the control asking for the order to be set again leaves. */
  focusTarget: RefObject<HTMLElement | null>
}

/**
 * What {@link useResortableOrder} hands back.
 */
type UseResortableOrderResult<TItem> = {
  /** The items on show, each where it stood when the order was last set. */
  shown: TItem[]
  /** Whether a change waits to be shown: the items come in in another order, or some wait to be shown at all. */
  isChangeWaiting: boolean
  /** The list, whose top comes back into view as the order is set again. */
  listRef: RefObject<HTMLDivElement | null>
  /** Sets the order again, to the one the items come in, from the top of the list. */
  resortFromTop: () => void
}

/**
 * A list whose order is set at chosen moments and kept in between, so nothing moves while the reader works: as it
 * mounts, as the reset key changes, and when the reader asks. An item that comes in since goes where the caller
 * asks. Asking shows the list from its top, as {@link useShowFromTop} does.
 *
 * @param options - {@link UseResortableOrderOptions}.
 *
 * @returns The items as they show, whether a change waits, the list's handle, and the way to set the order again.
 */
export function useResortableOrder<TItem>({
  items,
  keyOf,
  resetKey,
  newcomerPlace,
  focusTarget,
}: UseResortableOrderOptions<TItem>): UseResortableOrderResult<TItem> {
  // How many times the reader has asked for the order to be set again
  const [sortings, setSortings] = useState(0)

  // The items, each kept where it stood when the order was last set
  const shown = useFirstSeenOrder({
    items,
    keyOf,
    resetKey: JSON.stringify([resetKey, sortings]),
    newcomerPlace,
  })

  // Whether any item waits to be shown, or stands elsewhere than the order it comes in would put it
  const isChangeWaiting =
    shown.length !== items.length || shown.some((item, index) => item !== items[index])

  // A function which sets the order again
  const resort = () => setSortings((count) => count + 1)

  // The list, and the way to set the order again from its top
  const { listRef, showFromTop: resortFromTop } = useShowFromTop({ show: resort, focusTarget })

  // The items as they show, whether a change waits, the list's handle, and the way to set the order again
  return { shown, isChangeWaiting, listRef, resortFromTop }
}
