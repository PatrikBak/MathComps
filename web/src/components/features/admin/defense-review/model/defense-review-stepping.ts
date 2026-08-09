/**
 * Where the open conversation sits in the queue.
 */
export type SelectionPosition = {
  /** Its 1-based place among the loaded conversations. */
  index: number
  /** How many conversations are loaded. */
  total: number
}

/**
 * Finds where the open conversation sits in the queue.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param openId - The conversation being read, or null while none is.
 *
 * @returns Its place, or -1 when none is open and when the one that is sits outside the loaded queue.
 */
function resolveOpenIndex(
  orderedConversationIds: readonly string[],
  openId: string | null
): number {
  // Nothing open sits before the queue rather than anywhere in it
  if (openId === null) return -1

  // Where the queue holds it, which is -1 for one opened from outside the queue
  return orderedConversationIds.indexOf(openId)
}

/**
 * Says whether there is a conversation that many places along to move to.
 *
 * With nothing open the queue can only be stepped into, never back out of: entering it is a move forward onto
 * the first conversation, and there is nothing behind that. One open but outside the loaded list, left there
 * by a filter or named from elsewhere, has no place to step from, and stepping into the queue's first
 * conversation from it would be a move nobody asked for.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param openId - The conversation being read, or null while none is.
 * @param delta - How many places along to look, forwards or backwards.
 *
 * @returns Whether the move is there to make.
 */
export function canStepFrom(
  orderedConversationIds: readonly string[],
  openId: string | null,
  delta: 1 | -1
): boolean {
  // Where the walk starts from
  const openIndex = resolveOpenIndex(orderedConversationIds, openId)

  // Standing outside the queue, so only entering it counts as a move
  if (openIndex < 0) {
    // Which is a move forward from nothing open, into a queue that has something to enter
    return openId === null && delta === 1 && orderedConversationIds.length > 0
  }

  // Where the move would land
  const next = openIndex + delta

  // Which the queue holds, or it stays put
  return next >= 0 && next < orderedConversationIds.length
}

/**
 * Finds the conversation that many places along.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param openId - The conversation being read, or null while none is.
 * @param delta - How many places along to move, forwards or backwards.
 *
 * @returns The conversation to move to, or null when there is none to move to.
 */
export function stepTarget(
  orderedConversationIds: readonly string[],
  openId: string | null,
  delta: 1 | -1
): string | null {
  // Nowhere to go, so the queue stays where it is
  if (!canStepFrom(orderedConversationIds, openId, delta)) return null

  // Nothing open sits at -1, so stepping forward from there lands on the first conversation without
  // needing a case of its own
  const openIndex = resolveOpenIndex(orderedConversationIds, openId)

  // The conversation that many places along
  return orderedConversationIds[openIndex + delta]
}

/**
 * Finds the next conversation along that is still unread.
 *
 * Only forward: a backlog is worked from where the reader is towards the end, not back over what they passed.
 * One open from outside the queue names no place to work forward from, so it offers no next.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param openId - The conversation being read, or null while none is.
 * @param unreadConversationIds - Which of them are still unread.
 *
 * @returns The next unread conversation, or null when the rest of the loaded queue has been read.
 */
export function findNextUnreadId(
  orderedConversationIds: readonly string[],
  openId: string | null,
  unreadConversationIds: ReadonlySet<string>
): string | null {
  // Where the walk starts from
  const openIndex = resolveOpenIndex(orderedConversationIds, openId)

  // Open from outside the queue, so there is no stretch of it left to work through
  if (openId !== null && openIndex < 0) return null

  // The first unread conversation past the one being read
  return (
    orderedConversationIds.find(
      (id, index) => index > openIndex && unreadConversationIds.has(id)
    ) ?? null
  )
}

/**
 * Counts where the open conversation sits, for the reader to be told how far through the queue they are.
 *
 * @param orderedConversationIds - Every loaded conversation's id, in the order the queue shows them.
 * @param openId - The conversation being read, or null while none is.
 *
 * @returns Its place, or null when nothing is open and when the one that is sits outside the loaded queue.
 */
export function describePosition(
  orderedConversationIds: readonly string[],
  openId: string | null
): SelectionPosition | null {
  // Where it sits
  const openIndex = resolveOpenIndex(orderedConversationIds, openId)

  // A conversation the queue doesn't hold has no place in it to report
  if (openIndex < 0) return null

  // Its place, counted the way it reads rather than the way it is indexed
  return { index: openIndex + 1, total: orderedConversationIds.length }
}
