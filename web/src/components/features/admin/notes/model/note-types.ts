import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import type {
  DefenseReportCategory,
  NamedDefenseTarget,
} from '@/components/features/defense/model/defense-types'

/**
 * One note an admin wrote about a conversation.
 */
export type AdminNote = {
  /** Stable identifier. */
  id: string
  /** The conversation it is about. */
  sessionId: string
  /** The reply it is against; null when it is against the conversation as a whole. */
  turnId: string | null
  /** The admin who wrote it. */
  author: UserIdentity
  /** Whether the admin reading it wrote it, which is what decides whether it can be revised or dropped. */
  isOwn: boolean
  /** The note as markdown/math source. */
  content: string
  /** Which failure it names; null when it names none. */
  category: DefenseReportCategory | null
  /** When it was settled, as an ISO-8601 string; null while it still stands. */
  resolvedAt: string | null
  /** When it was written, as an ISO-8601 string. */
  createdAt: string
  /** When it last changed, as an ISO-8601 string. */
  updatedAt: string
}

/**
 * One note in the cross-conversation feed, carrying enough of where it was written to be read on its own.
 */
export type AdminNoteFeedItem = {
  /** The note. */
  note: AdminNote
  /** The problem its conversation was held against. */
  target: NamedDefenseTarget
  /** Who held that conversation. */
  user: UserIdentity
  /** Where the reply it is against sits; null when it is against the conversation as a whole. */
  turnSequence: number | null
}
