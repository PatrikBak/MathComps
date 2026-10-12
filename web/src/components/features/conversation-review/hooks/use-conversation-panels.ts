import { useCallback, useState } from 'react'

import { useMinWidth } from '@/hooks/use-breakpoint'

/**
 * A part that can stand beside a conversation rather than in place of it: the grade, the graders' conversation
 * with the student about the grade, the solution it is judged against, what has been written about it, or the settings
 * the examiner ran on.
 */
export type SidePanelId = 'grade' | 'feedback' | 'reference' | 'notes' | 'config'

/**
 * One of the parts a conversation is read in. The conversation itself is never beside anything, since it is what
 * the others are read against.
 */
export type ConversationPanelId = 'conversation' | SidePanelId

/**
 * What {@link useConversationPanels} hands back.
 */
export type UseConversationPanelsResult = {
  /** Which part of the conversation the reader picked last. */
  selectedTabId: ConversationPanelId
  /** Which of the side panels is showing, which is never the conversation or a panel with a column of its own. */
  sideTabId: SidePanelId
  /** The side panels that are tabs, in the order they read. */
  sideTabIds: SidePanelId[]
  /** Shows another part. */
  selectTab: (tabId: ConversationPanelId) => void
  /** Whether there is room to stand the transcript and the side panels next to each other. */
  isSplit: boolean
  /** Whether there is room for the reference to stop being a tab and simply stay on screen. */
  hasReferenceColumn: boolean
  /** Puts the reader back on the conversation. */
  reset: () => void
}

/** The side panels every conversation has, in the order their tabs read. */
const SIDE_PANELS: readonly SidePanelId[] = ['reference', 'notes', 'config']

/**
 * The side panels where there is a grade to give, the grade first and the conversation with the student after it.
 */
const GRADED_SIDE_PANELS: readonly SidePanelId[] = ['grade', 'feedback', ...SIDE_PANELS]

/**
 * Decides how much of a conversation stands on screen at once, and which part the reader is looking at.
 *
 * Which part stands beside the conversation is not simply the part the reader picked, since what the viewport
 * can give changes which parts are tabs at all: a reader who picked the reference on a narrow screen is looking
 * straight at it on a wide one, so the side falls to the first tab left. The grade stands first wherever there is
 * one, the conversation with the student right behind it, and a pick of either falls the same way where there
 * isn't.
 *
 * The pick is held for as long as the dialog stays up, so stepping to the next item stays on the part being read.
 * Being sent to a note turns to the notes.
 *
 * @param hasGradeToGive - Whether there is a grade to give on the problem.
 * @param landingNoteId - The note the reader was sent to; null when they came in for the conversation itself.
 * @param initialTabId - The part the dialog's first opening starts on; null for the conversation. Every later
 * opening starts on the conversation.
 *
 * @returns The layout as described by {@link UseConversationPanelsResult}.
 */
export function useConversationPanels(
  hasGradeToGive: boolean,
  landingNoteId: string | null,
  initialTabId: SidePanelId | null
): UseConversationPanelsResult {
  // The part the reader picked, starting where the first opening was sent
  const [selectedTabId, setSelectedTabId] = useState<ConversationPanelId>(
    initialTabId ?? 'conversation'
  )

  // Which note the reader has already been taken to, so that being sent to one is what moves them rather
  // than its still being named after they have walked off it
  const [shownNoteId, setShownNoteId] = useState(landingNoteId)

  // A note the reader has not been taken to yet
  if (shownNoteId !== landingNoteId) {
    // Taken to as of now
    setShownNoteId(landingNoteId)

    // Onto the notes, unless the reader was sent nowhere
    if (landingNoteId !== null) setSelectedTabId('notes')
  }

  // The dialog runs to 72rem, so the split only earns its place once the viewport can actually give it that
  const isSplit = useMinWidth('xl')

  // Whether the reference can stay on screen, so judging the conversation doesn't hide the very thing the
  // judgement is made from
  const hasReferenceColumn = useMinWidth('2xl')

  // The side panels that are still tabs, the reference dropping out once it has a column
  const sideTabIds = (hasGradeToGive ? GRADED_SIDE_PANELS : SIDE_PANELS).filter(
    (id) => !hasReferenceColumn || id !== 'reference'
  )

  // The side panel showing: the one picked while it is still a tab, and the first tab otherwise
  const sideTabId = sideTabIds.find((id) => id === selectedTabId) ?? sideTabIds[0]

  // A function which puts the reader back on the conversation
  const reset = useCallback(() => setSelectedTabId('conversation'), [setSelectedTabId])

  // What stands on screen, and the way to show something else
  return {
    selectedTabId,
    sideTabId,
    sideTabIds,
    selectTab: setSelectedTabId,
    isSplit,
    hasReferenceColumn,
    reset,
  }
}
