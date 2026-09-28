import { resolveOpenIndex } from '@/lib/stepping'

/** The key that skips to the next conversation still unread, as printed on the keyboard. */
export const NEXT_UNREAD_KEY = 'u'

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
