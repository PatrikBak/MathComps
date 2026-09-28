import { useState } from 'react'

import {
  type SidePanelId,
  useConversationPanels,
  type UseConversationPanelsResult,
} from '@/components/features/admin/hooks/use-conversation-panels'

/**
 * One of the review's own panels, read beside the conversation: the settings the examiner ran on, and what has
 * been written about it.
 */
export type DefenseReviewPanelId = 'config' | 'notes'

/** The review's side panels, in the order their tabs read. */
const DEFENSE_REVIEW_SIDE_PANELS: readonly SidePanelId<DefenseReviewPanelId>[] = [
  'reference',
  'config',
  'notes',
]

/**
 * Decides how much of a conversation under review stands on screen at once, and which part the reader is
 * looking at. The pick is held across the whole dialog, so stepping to the next conversation stays on it, and
 * being sent to a note turns to the notes.
 *
 * @param landingNoteId - The note the reader was sent to; null when they came in for the conversation itself.
 *
 * @returns The layout as described by {@link UseConversationPanelsResult}.
 */
export function useDefenseReviewPanels(
  landingNoteId: string | null
): UseConversationPanelsResult<DefenseReviewPanelId> {
  // The layout, with the reader's pick held for as long as the dialog stays up
  const panels = useConversationPanels(DEFENSE_REVIEW_SIDE_PANELS, null)

  // Which note the reader has already been taken to, so that being sent to one is what moves them rather
  // than its still being named after they have walked off it
  const [shownNoteId, setShownNoteId] = useState(landingNoteId)

  // A note they have not been taken to yet
  if (shownNoteId !== landingNoteId) {
    // Taken to as of now
    setShownNoteId(landingNoteId)

    // Being sent to a note is being sent to what was written about the conversation rather than to the
    // conversation itself, which is where an open otherwise begins
    if (landingNoteId !== null) panels.selectTab('notes')
  }

  // What stands on screen, and the way to show something else
  return panels
}
