/**
 * What a row listing a conversation says about having been read.
 */
export type ReadStateSnapshot = {
  /** When it was last read, as an ISO-8601 string; null while it never had been. */
  readAt: string | null
  /** Whether anything in it stood unread. */
  isUnread: boolean
  /** How many of its author's messages were new. */
  unreadStudentMessageCount: number
}

/**
 * A row listing a conversation, down to what it says about having been read and how much its author wrote.
 */
export type ReadStateRow = ReadStateSnapshot & {
  /** How many messages its author wrote. */
  studentMessageCount: number
}

/**
 * The lists a page holds conversations and their notes in beside the conversation dialog, kept in step with what
 * the dialog writes.
 */
export type ConversationListSync = {
  /**
   * Rewrites what every row listing a conversation says about having been read.
   *
   * @param sessionId - The conversation.
   * @param rewrite - Produces a row's read state as it now stands, from the row as it stood.
   */
  patchReadState: (sessionId: string, rewrite: (row: ReadStateRow) => ReadStateSnapshot) => void
  /**
   * Takes in a write that landed against a conversation's notes.
   *
   * @param sessionId - The conversation.
   * @param countDelta - How far the write moved the number of notes it has.
   */
  noteWritten: (sessionId: string, countDelta: number) => void
}
