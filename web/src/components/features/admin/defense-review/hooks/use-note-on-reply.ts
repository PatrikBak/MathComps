import { type RefObject, useRef } from 'react'
import { flushSync } from 'react-dom'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'

import type { DefenseReviewTabId } from '../model/defense-review-tabs'

/**
 * What {@link useNoteOnReply} hands back.
 */
export type UseNoteOnReplyResult = {
  /** The editor a new note is written in. */
  composerRef: RefObject<RichMathEditorRef | null>
  /** Starts a note on one reply: pointed at it, with the notes on screen and the cursor in the editor. */
  startNoteOn: (turnId: string) => void
}

/**
 * Starting a note from the reply it is about.
 *
 * When a note is started, the notes are usually a hidden tab: behind the conversation where every part is a tab,
 * or behind another side panel where the two stand side by side. A hidden editor can't take the cursor, so the
 * switch to the notes is committed before the cursor is handed over.
 *
 * @param selectTab - Shows another part of the conversation.
 * @param onNoteTurnIdChange - Points a new note at another reply, or at the conversation as a whole.
 *
 * @returns The editor's handle and the way to start a note, as described by {@link UseNoteOnReplyResult}.
 */
export function useNoteOnReply(
  selectTab: (tabId: DefenseReviewTabId) => void,
  onNoteTurnIdChange: (turnId: string | null) => void
): UseNoteOnReplyResult {
  // The editor a new note is written in
  const composerRef = useRef<RichMathEditorRef>(null)

  /**
   * A function which starts a note on one reply.
   *
   * @param turnId - The reply.
   */
  const startNoteOn = (turnId: string) => {
    // The switch to the notes, committed at once
    flushSync(() => {
      // The note pointed at the reply
      onNoteTurnIdChange(turnId)

      // The notes shown
      selectTab('notes')
    })

    // The cursor in the editor, ready for the note
    composerRef.current?.focus()
  }

  // The editor's handle, and the way to start a note
  return { composerRef, startNoteOn }
}
