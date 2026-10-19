import { assertNever } from '@/components/shared/utils/assert-never'

/**
 * Where an item seen for the first time goes in a list that keeps every item where it first appeared: on top, or
 * where the order the items come in puts it, right after the item it comes in behind.
 */
export type NewcomerPlace = 'top' | 'inPlace'

/**
 * Adds the newcomers to the keys of a list that keeps every item where it first appeared, each where it goes.
 *
 * @param seen - Every key shown so far, top to bottom.
 * @param incoming - The keys, in the order they come in now.
 * @param newcomers - The keys never shown before, in the order they come in.
 * @param newcomerPlace - Where an item seen for the first time goes.
 *
 * @returns Every key from here on, top to bottom.
 */
export function withNewcomers(
  seen: readonly string[],
  incoming: readonly string[],
  newcomers: readonly string[],
  newcomerPlace: NewcomerPlace
): string[] {
  // Where the newcomers go
  switch (newcomerPlace) {
    // On top, in the order they come in
    case 'top':
      return [...newcomers, ...seen]

    // Each right after the key it comes in behind, already in the list by then, or on top when it comes in first
    case 'inPlace':
      return newcomers.reduce<string[]>(
        (order, key) => {
          // Where the newcomer comes in
          const incomingIndex = incoming.indexOf(key)

          // Its place: just after the key it comes in behind, or on top
          const at = incomingIndex === 0 ? 0 : order.indexOf(incoming[incomingIndex - 1]) + 1

          // The list with the newcomer in its place
          return [...order.slice(0, at), key, ...order.slice(at)]
        },
        [...seen]
      )

    // Every place is handled above
    default:
      return assertNever(newcomerPlace)
  }
}
