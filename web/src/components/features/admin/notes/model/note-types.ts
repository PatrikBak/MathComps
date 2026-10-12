import type { ReviewNote } from '@/components/features/conversation-review/model/note-types'
import type { NamedDefenseTarget } from '@/components/features/defense/model/defense-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'

/**
 * One note in the cross-conversation feed, carrying enough of where it was written to be read on its own.
 */
export type AdminNoteFeedItem = {
  /** The note. */
  note: ReviewNote
  /** The problem its conversation was held against. */
  target: NamedDefenseTarget
  /** Who held that conversation. */
  user: UserIdentity
  /** Where the reply it is against sits; null when it is against the conversation as a whole. */
  turnSequence: number | null
}
