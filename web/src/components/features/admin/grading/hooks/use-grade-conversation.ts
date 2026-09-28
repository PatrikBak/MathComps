import { useState } from 'react'

/**
 * Which conversation is showing, on which grade.
 */
type ConversationPick = {
  /** The grade, by its pair key; null while none is open. */
  key: string | null
  /** Which of its conversations is showing, counting from one. */
  number: number
}

/**
 * What {@link useGradeConversation} hands back.
 */
type UseGradeConversationResult = {
  /** Which of the open grade's conversations is showing, counting from one. */
  conversation: number
  /** Shows another of the open grade's conversations, by its number. */
  selectConversation: (number: number) => void
}

/**
 * Holds which of the open grade's conversations is showing. Every grade opens on its first conversation, except
 * the one already open when the board opens, which starts on the conversation it was handed.
 *
 * @param openKey - The open grade, by its pair key; null while none is.
 * @param initialConversation - Which conversation the grade open when the board opened is showing, counting from
 * one.
 *
 * @returns The conversation as described by {@link UseGradeConversationResult}.
 */
export function useGradeConversation(
  openKey: string | null,
  initialConversation: number
): UseGradeConversationResult {
  // Which conversation is showing, and on which grade
  const [pick, setPick] = useState<ConversationPick>({ key: openKey, number: initialConversation })

  // Another grade opening starts on its first conversation
  if (pick.key !== openKey) setPick({ key: openKey, number: 1 })

  // The conversation showing, the first while the pick catches up with a grade just opened
  const conversation = pick.key === openKey ? pick.number : 1

  // A function which shows another of the open grade's conversations
  const selectConversation = (number: number) => setPick({ key: openKey, number })

  // Which conversation is showing, and the way to another
  return { conversation, selectConversation }
}
