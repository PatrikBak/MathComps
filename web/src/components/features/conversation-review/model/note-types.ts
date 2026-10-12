import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'
import type { UserIdentity } from '@/components/features/profile/model/user-identity'

/**
 * One note a reviewer wrote about a conversation.
 */
export type ReviewNote = {
  /** Stable identifier. */
  id: string
  /** The conversation it is about. */
  sessionId: string
  /** The reply it is against; null when it is against the conversation as a whole. */
  turnId: string | null
  /** The reviewer who wrote it. */
  author: UserIdentity
  /** Whether the reviewer reading it wrote it, which is what decides whether it can be revised or dropped. */
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
