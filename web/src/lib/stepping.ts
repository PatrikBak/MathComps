/**
 * Where the open item sits in the list being walked.
 */
export type SelectionPosition = {
  /** The open item's 1-based place among the listed items. */
  index: number
  /** How many items are listed. */
  total: number
}

/**
 * Finds where the open item sits in the list.
 *
 * @param orderedIds - Every listed item's id, in the order the list shows them.
 * @param openId - The item open, or null while none is.
 *
 * @returns The open item's 0-based index, or -1 when none is open and when the one that is sits outside the list.
 */
export function resolveOpenIndex(orderedIds: readonly string[], openId: string | null): number {
  // Nothing open sits before the list rather than anywhere in it
  if (openId === null) return -1

  // Where the list holds it, which is -1 for an item the list doesn't hold
  return orderedIds.indexOf(openId)
}

/**
 * Says whether there is an item one place along to move to.
 *
 * With nothing open the list can only be stepped into, never back out of: entering it is a move forward onto the
 * first item, and there is nothing behind that. One open but outside the list has no place to step from, and
 * stepping into the first item from it would be a move nobody asked for.
 *
 * @param orderedIds - As in {@link resolveOpenIndex}.
 * @param openId - As in {@link resolveOpenIndex}.
 * @param delta - Which way to look: one place forward or one back.
 *
 * @returns Whether the move is there to make.
 */
export function canStepFrom(
  orderedIds: readonly string[],
  openId: string | null,
  delta: 1 | -1
): boolean {
  // Where the walk starts from
  const openIndex = resolveOpenIndex(orderedIds, openId)

  // Standing outside the list, so only entering it counts as a move
  if (openIndex < 0) {
    // Which is a move forward from nothing open, into a list that has something to enter
    return openId === null && delta === 1 && orderedIds.length > 0
  }

  // Where the move would land
  const next = openIndex + delta

  // Which the list holds, or it stays put
  return next >= 0 && next < orderedIds.length
}

/**
 * Finds the item one place along.
 *
 * @param orderedIds - As in {@link resolveOpenIndex}.
 * @param openId - As in {@link resolveOpenIndex}.
 * @param delta - Which way to move: one place forward or one back.
 *
 * @returns The item to move to, or null when there is none to move to.
 */
export function stepTarget(
  orderedIds: readonly string[],
  openId: string | null,
  delta: 1 | -1
): string | null {
  // Nowhere to go, so the list stays where it is
  if (!canStepFrom(orderedIds, openId, delta)) return null

  // Where the walk starts from, -1 with nothing open
  const openIndex = resolveOpenIndex(orderedIds, openId)

  // The item one place along, the first one when nothing is open
  return orderedIds[openIndex + delta]
}

/**
 * Counts where the open item sits in the list.
 *
 * @param orderedIds - As in {@link resolveOpenIndex}.
 * @param openId - As in {@link resolveOpenIndex}.
 *
 * @returns Its place, or null when nothing is open and when the one that is sits outside the list.
 */
export function describePosition(
  orderedIds: readonly string[],
  openId: string | null
): SelectionPosition | null {
  // Where the open item sits
  const openIndex = resolveOpenIndex(orderedIds, openId)

  // An item the list doesn't hold has no place in it to report
  if (openIndex < 0) return null

  // Its place, counted the way it reads rather than the way it is indexed
  return { index: openIndex + 1, total: orderedIds.length }
}
