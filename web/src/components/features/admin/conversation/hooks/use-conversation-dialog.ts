import { useFocusReturn } from '@/hooks/use-focus-return'
import { useKeyedState } from '@/hooks/use-keyed-state'
import type { QueryUiState } from '@/lib/query-ui-state'

import { useUpdateGrade, type UseUpdateGradeResult } from '../../grades/hooks/use-update-grade'
import type { AdminConversation, StudentConversations } from '../model/admin-conversation'
import { useConversationDetail } from './use-conversation-detail'
import {
  type SidePanelId,
  useConversationPanels,
  type UseConversationPanelsResult,
} from './use-conversation-panels'
import {
  useConversationReadMarking,
  type UseConversationReadMarkingResult,
} from './use-conversation-read-marking'
import { useConversationReadState } from './use-conversation-read-state'
import { type StudentProblem, useStudentConversations } from './use-student-conversations'

/**
 * What {@link useConversationDialog} hands back.
 */
export type UseConversationDialogResult = {
  /**
   * The conversation on screen, as it arrived; null until it has. A switch to another of the student's
   * conversations leaves it up until that one arrives.
   */
  detail: AdminConversation | null
  /** Every conversation the student held about the problem, and their grading; null until they have arrived. */
  studentConversations: StudentConversations | null
  /** How far reading what goes on screen has got. */
  uiState: QueryUiState
  /** How much stands on screen at once, and which part the reader is looking at. */
  panels: UseConversationPanelsResult
  /** Whether the conversation counts as read, and where the last pass through it stopped. */
  readMarking: UseConversationReadMarkingResult
  /** Which reply a new note will stand against; null for the conversation as a whole. */
  noteTurnId: string | null
  /** Points a new note at another reply, or at the conversation as a whole. */
  setNoteTurnId: (turnId: string | null) => void
  /** Shows another of the student's conversations about the problem. */
  selectConversation: (conversationId: string) => void
  /** {@link UseUpdateGradeResult.changeGrade}. */
  changeGrade: UseUpdateGradeResult['changeGrade']
  /** Wipes the dialog session once the dialog has finished leaving, and hands focus back to the page. */
  handleClosed: () => void
}

/**
 * Everything the conversation dialog reads and does: which of the student's conversations is on screen, where
 * their grade stands, reading it, and closing.
 *
 * Changes to the grade are made from here rather than from the panel showing it, which comes and goes with the
 * conversation on screen while a change made in it may still be settling.
 *
 * @param openId - Which item of the page's list is open; null while none is.
 * @param studentProblem - The student and problem the open item is about; null while that is unknown.
 * @param itemsAreConversations - Whether each item is itself one of a student's conversations, which the dialog
 * then starts on rather than on the first they held.
 * @param landingNoteId - The note the reader was sent to; null when they came in for the conversation itself.
 * @param initialTabId - The part the dialog's first opening starts on; null for the conversation.
 * @param onClosed - Runs once the dialog has finished leaving, after focus has gone back to the page.
 * @returns The dialog's state as described by {@link UseConversationDialogResult}.
 */
export function useConversationDialog(
  openId: string | null,
  studentProblem: StudentProblem | null,
  itemsAreConversations: boolean,
  landingNoteId: string | null,
  initialTabId: SidePanelId | null,
  onClosed: (() => void) | undefined
): UseConversationDialogResult {
  // Every conversation the student held about the problem, and where their grade on it stands
  const { studentConversations, uiState: listUiState } = useStudentConversations(studentProblem)

  // The conversation the reader switched to, back on the one the item starts on whenever another opens
  const [pickedConversationId, selectConversation] = useKeyedState(
    openId,
    itemsAreConversations ? openId : null
  )

  // The conversation asked for: the one picked, else the student's first; null while neither is known
  const conversationId = pickedConversationId ?? studentConversations?.conversations[0]?.id ?? null

  // The conversation asked for, read in full
  const { detail: arrived, uiState: detailUiState } = useConversationDetail(conversationId)

  // The last of the item's conversations to have arrived
  const [lastArrived, setLastArrived] = useKeyedState(openId, arrived)

  // A newer arrival, held from now on
  if (arrived !== null && arrived !== lastArrived) setLastArrived(arrived)

  // The conversation on screen: the one asked for, else the last one while a switch is on its way, so the
  // switch the reader pressed stays under their finger. Dropped once the one asked for fails, so that shows.
  const detail = arrived ?? (detailUiState.kind === 'failed' ? null : lastArrived)

  // Where the grade stands; null unless the student is graded on the problem
  const grading = studentConversations?.grading ?? null

  // Whether there is a grade to give: the student is graded, and something they said counts toward it
  const hasGradeToGive = grading !== null && grading.countingConversationIds.length > 0

  // How much of the conversation stands on screen at once, and which part the reader is looking at
  const panels = useConversationPanels(hasGradeToGive, landingNoteId, initialTabId)

  // Recording which conversations have been read
  const { markRead, markUnread, markUnreadFrom } = useConversationReadState()

  // Whether the conversation asked for counts as read, and where the last pass through it stopped
  const readMarking = useConversationReadMarking(
    arrived,
    conversationId,
    markRead,
    markUnread,
    markUnreadFrom
  )

  // Which reply a new note will stand against, held here because the transcript marks it too
  const [noteTurnId, setNoteTurnId] = useKeyedState<string | null>(conversationId, null)

  // Changing grades
  const { changeGrade } = useUpdateGrade()

  // How far reading what goes on screen has got: a failed conversation, else the list until it has arrived,
  // since the list is what names the conversation and says whether there is a grade
  const uiState =
    detailUiState.kind === 'failed' || listUiState.kind === 'ready' ? detailUiState : listUiState

  // A function which puts focus back on whatever stands for the item the reader ended on
  const returnFocus = useFocusReturn(openId)

  // A function which wipes the dialog session once the dialog has finished leaving
  const handleClosed = () => {
    // Back on the conversation for the next open
    panels.reset()

    // Forget every conversation this dialog session went through
    readMarking.reset()

    // Back on whatever stands for the item the reader ended on
    returnFocus()

    // Report the dialog as gone
    onClosed?.()
  }

  // What the dialog shows, and every way of acting on it
  return {
    detail,
    studentConversations,
    uiState,
    panels,
    readMarking,
    noteTurnId,
    setNoteTurnId,
    selectConversation,
    changeGrade,
    handleClosed,
  }
}
