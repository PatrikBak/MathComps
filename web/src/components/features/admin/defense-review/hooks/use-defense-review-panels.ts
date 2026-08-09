import { useCallback, useState } from 'react'

import { useMinWidth } from '@/hooks/use-breakpoint'

import {
  type DefenseReviewSideTabId,
  type DefenseReviewTabId,
  resolveSideTabId,
} from '../model/defense-review-tabs'

/**
 * What {@link useDefenseReviewPanels} hands back.
 */
export type UseDefenseReviewPanelsResult = {
  /** Which part of the conversation the reader picked last. */
  selectedTabId: DefenseReviewTabId
  /** Which of the side panels is showing, which is never the conversation or a panel with a column of its own. */
  sideTabId: DefenseReviewSideTabId
  /** Shows another part. */
  selectTab: (tabId: DefenseReviewTabId) => void
  /** Whether there is room to stand the transcript and the side panels next to each other. */
  isSplit: boolean
  /** Whether there is room for the reference to stop being a tab and simply stay on screen. */
  hasReferenceColumn: boolean
  /** Puts the reader back on the conversation, to be run once the dialog has finished leaving. */
  reset: () => void
}

/**
 * Decides how much of a conversation stands on screen at once, and which part the reader is looking at.
 *
 * Which part stands beside the conversation is not simply the part the reader picked, since what the viewport
 * can give changes which parts are tabs at all; {@link resolveSideTabId} is where that falls out.
 *
 * @param landingNoteId - The note the reader was sent to; null when they came in for the conversation itself.
 *
 * @returns The layout as described by {@link UseDefenseReviewPanelsResult}.
 */
export function useDefenseReviewPanels(landingNoteId: string | null): UseDefenseReviewPanelsResult {
  // Which part of it is showing, held above the conversation so stepping to the next one stays on it
  const [selectedTabId, setSelectedTabId] = useState<DefenseReviewTabId>('conversation')

  // Which note the reader has already been taken to, so that being sent to one is what moves them rather
  // than its still being named after they have walked off it
  const [shownNoteId, setShownNoteId] = useState(landingNoteId)

  // A note they have not been taken to yet
  if (shownNoteId !== landingNoteId) {
    // Taken to as of now
    setShownNoteId(landingNoteId)

    // Being sent to a note is being sent to what was written about the conversation rather than to the
    // conversation itself, which is where an open otherwise begins
    if (landingNoteId !== null) setSelectedTabId('notes')
  }

  // The panel runs to 72rem, so the split only earns its place once the viewport can actually give it that
  const isSplit = useMinWidth('xl')

  // Whether the reference can stay on screen, so writing down what was wrong with a reply doesn't hide the
  // very thing the judgement is made from
  const hasReferenceColumn = useMinWidth('2xl')

  // Which side panel is showing
  const sideTabId = resolveSideTabId(selectedTabId, hasReferenceColumn)

  // Back to the conversation, which is where every open begins
  const reset = useCallback(() => setSelectedTabId('conversation'), [])

  // What stands on screen, and the way to show something else
  return {
    selectedTabId,
    sideTabId,
    selectTab: setSelectedTabId,
    isSplit,
    hasReferenceColumn,
    reset,
  }
}
