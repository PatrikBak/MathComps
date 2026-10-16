'use client'

import { useState } from 'react'

/**
 * The order a {@link useFirstSeenOrder} holds.
 */
type HeldOrder = {
  /** The reset key the order was built under. */
  resetKey: unknown
  /** Every key shown so far, top to bottom. */
  seen: readonly string[]
}

/**
 * Options for {@link useFirstSeenOrder}.
 */
type UseFirstSeenOrderOptions<TItem> = {
  /** The items, in the order they come in now. */
  items: readonly TItem[]
  /** The key an item keeps while the list changes around it. */
  keyOf: (item: TItem) => string
  /** A value whose change forgets the held order, so the list takes the order the items come in at that moment. */
  resetKey: unknown
}

/**
 * A list that keeps every item where it first appeared, however the order the items come in changes, so nothing on
 * screen moves under the reader. An item seen for the first time goes on top; everything else stays put.
 *
 * Say the items come in as A, B, C. Later C moves up and they come in as C, A, B: the list still reads A, B, C. Then
 * D comes in too, as D, C, A, B: the list reads D, A, B, C. Several newcomers at once go on top in the order they
 * come in. An item that drops out and comes back takes its old place again.
 *
 * Changing the reset key forgets the held order, and so does mounting afresh: the list then reads in the order the
 * items come in.
 *
 * @param options - {@link UseFirstSeenOrderOptions}.
 *
 * @returns The items present, in the held order.
 */
export function useFirstSeenOrder<TItem>({
  items,
  keyOf,
  resetKey,
}: UseFirstSeenOrderOptions<TItem>): TItem[] {
  // The keys shown so far, top to bottom, with the reset key they were shown under
  const [held, setHeld] = useState<HeldOrder>({ resetKey, seen: [] })

  // The keys shown so far, forgotten once the reset key changes
  const seen = held.resetKey === resetKey ? held.seen : []

  // The keys never shown before, in the order they come in
  const newcomers = items.map(keyOf).filter((key) => !seen.includes(key))

  // The newcomers on top, everything shown before below them in its old place
  const order = newcomers.length === 0 ? seen : [...newcomers, ...seen]

  // Remembered for the renders to come, whenever this one changed it
  if (order !== held.seen || resetKey !== held.resetKey) setHeld({ resetKey, seen: order })

  // Each item present, by its key
  const byKey = new Map(items.map((item) => [keyOf(item), item]))

  // The items present, in the held order
  return order.flatMap((key) => {
    // The item under the key, if it is still in the list
    const item = byKey.get(key)

    // Skipped while it is gone, its place kept for when it comes back
    return item === undefined ? [] : [item]
  })
}
