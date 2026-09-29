import { useCallbackRef } from '@mantine/hooks'
import { useEffect, useRef, useState } from 'react'

/**
 * What {@link useGradeComment} hands back.
 */
type UseGradeCommentResult = {
  /** The comment as it is being written. */
  draft: string
  /** Rewrites the draft. */
  setDraft: (draft: string) => void
  /** Saves the draft, where it says something not already sent. */
  commit: () => void
}

/**
 * The comment for graders on one grade, written in place and saved when the grader moves off it: on leaving the
 * field, and whenever the field goes away, as it does on stepping to another grade or closing the dialog. A
 * comment already sent is not sent again, and one the server refused counts as never sent, so moving off the
 * field again sends it again.
 *
 * @param saved - The comment as the grade holds it when the grade is opened.
 * @param onSave - Saves a new comment, resolving to whether the server took it.
 *
 * @returns The draft as described by {@link UseGradeCommentResult}.
 */
export function useGradeComment(
  saved: string,
  onSave: (comment: string) => Promise<boolean>
): UseGradeCommentResult {
  // The comment as it is being written, starting from the saved one
  const [draft, setDraft] = useState(saved)

  // The comment last sent, starting from the saved one, so leaving the field and then the grade sends it once
  const sentRef = useRef(saved)

  // Saves the draft where it moved, reading whatever the draft says by the time it runs
  const commit = useCallbackRef(() => {
    // Nothing new to send
    if (draft === sentRef.current) return

    // What counted as sent before this one, for a refusal to fall back to
    const previous = sentRef.current

    // Sent as of now
    sentRef.current = draft

    // The save itself, whose answer decides whether it stays sent
    onSave(draft).then((taken) => {
      // A refusal counts as never sent, unless something newer went out meanwhile and decides instead
      if (!taken && sentRef.current === draft) sentRef.current = previous
    })
  })

  // Leaving the grade takes the field away without it ever losing focus, so whatever was still being written is
  // saved on the way out
  useEffect(() => commit, [commit])

  // The draft, and the ways to write and save it
  return { draft, setDraft, commit }
}
