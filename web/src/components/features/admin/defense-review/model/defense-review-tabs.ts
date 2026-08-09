import { assertNever } from '@/components/shared/utils/assert-never'

/**
 * One of the parts a conversation is read in.
 */
export type DefenseReviewTabId = 'conversation' | 'reference' | 'config' | 'notes'

/**
 * A part that can stand beside the conversation rather than in place of it. The conversation itself is never
 * one, since it is what the others are read against.
 */
export type DefenseReviewSideTabId = Exclude<DefenseReviewTabId, 'conversation'>

/**
 * Works out which part stands beside the conversation, given the one the reader picked.
 *
 * What the viewport can give changes which parts are tabs at all, so the part the reader picked and the part
 * actually showing beside the conversation are two different things: a reader who selected the reference on a
 * narrow screen is looking straight at it on a wide one, and what stands beside it has to fall to something
 * else rather than to a tab that is no longer there.
 *
 * @param selectedTabId - The part the reader picked last.
 * @param hasReferenceColumn - Whether the reference has a column of its own and so is not a tab.
 *
 * @returns The part to show beside the conversation.
 */
export function resolveSideTabId(
  selectedTabId: DefenseReviewTabId,
  hasReferenceColumn: boolean
): DefenseReviewSideTabId {
  // Which part stands beside the conversation depends on the one the reader is on
  switch (selectedTabId) {
    // Neither of these can be the part standing beside the conversation: the conversation is never beside
    // itself, and the reference stops being a tab once it has a column
    case 'conversation':
    case 'reference':
      return hasReferenceColumn ? 'config' : 'reference'

    // The settings stand beside the conversation whatever the viewport gives
    case 'config':
      return 'config'

    // As do the notes
    case 'notes':
      return 'notes'

    // A part outside the union, which the type system rules out
    default:
      return assertNever(selectedTabId)
  }
}
