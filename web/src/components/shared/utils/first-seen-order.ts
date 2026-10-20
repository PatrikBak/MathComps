import { assertNever } from '@/components/shared/utils/assert-never'

/**
 * Where an item seen for the first time goes in a list that keeps every item where it first appeared: on top; where
 * the order the items come in puts it, right after the item it comes in behind; or, once the list has shown anything,
 * nowhere until its order is set afresh.
 */
export type NewcomerPlace = 'top' | 'inPlace' | 'waiting'

/**
 * Places the newcomers among the keys of a list that keeps every item where it first appeared, each where its place
 * says.
 *
 * @param seen - Every key shown so far, top to bottom.
 * @param incoming - The keys, in the order they come in now.
 * @param newcomers - The keys never shown before, in the order they come in.
 * @param newcomerPlace - Where an item seen for the first time goes.
 *
 * @returns Every key from here on, top to bottom; the keys shown so far themselves where the newcomers wait.
 */
export function withNewcomers(
  seen: readonly string[],
  incoming: readonly string[],
  newcomers: readonly string[],
  newcomerPlace: NewcomerPlace
): readonly string[] {
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

    // Kept out, the list handed back as it was, unless it has shown nothing yet, which is the order being set afresh
    // and takes every one of them
    case 'waiting':
      return seen.length === 0 ? [...incoming] : seen

    // Every place is handled above
    default:
      return assertNever(newcomerPlace)
  }
}
