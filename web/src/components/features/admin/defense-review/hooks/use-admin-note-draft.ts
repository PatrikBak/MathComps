import { useState } from 'react'

import type { DefenseReportCategory } from '@/components/features/defense/model/defense-types'

/**
 * What {@link useAdminNoteDraft} hands back.
 */
type UseAdminNoteDraftResult = {
  /** What the note currently says, as markdown/math source. */
  content: string
  /** Rewrites what it says. */
  setContent: (content: string) => void
  /** Which failure it currently names; null while it names none. */
  category: DefenseReportCategory | null
  /** Names another failure, or none. */
  setCategory: (category: DefenseReportCategory | null) => void
  /** Whether it says anything other than what it was opened on, which is what makes filing it a write. */
  hasChanged: boolean
  /** Whether this note is on its way to being filed. */
  isSubmitting: boolean
  /** Hands it over, emptying the draft only once it has landed somewhere other than this box. */
  submit: () => Promise<void>
}

/**
 * A note being written or revised.
 *
 * What was typed is let go of only once the write has landed: a note that failed to save is still the reviewer's
 * only copy of it, and emptying the box on the way out would lose it.
 *
 * Whether it is on its way is held here rather than read off the writes against the conversation, which are one
 * shared flight covering every note on screen: settling somebody else's would otherwise stand this box down.
 *
 * @param initialContent - What the note says to begin with, empty for a new one.
 * @param initialCategory - Which failure it names to begin with.
 * @param onSubmit - Takes the note as written, reporting whether it landed.
 * @returns The draft as described by {@link UseAdminNoteDraftResult}.
 */
export function useAdminNoteDraft(
  initialContent: string,
  initialCategory: DefenseReportCategory | null,
  onSubmit: (content: string, category: DefenseReportCategory | null) => Promise<boolean>
): UseAdminNoteDraftResult {
  // What the note currently says
  const [content, setContent] = useState(initialContent)

  // Which failure it currently names
  const [category, setCategory] = useState<DefenseReportCategory | null>(initialCategory)

  // Whether this note is on its way to being filed
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Whether it says anything other than what it was opened on, so revising it back to itself isn't a write
  const hasChanged = content.trim() !== initialContent.trim() || category !== initialCategory

  // Hands the note over, and empties the box only once it is somewhere else
  const submit = async () => {
    // On its way, so the box stands down until it is somewhere
    setIsSubmitting(true)

    // Handed over, however it goes
    try {
      // Landed, so this box is no longer the only copy of what was written
      if (await onSubmit(content.trim(), category)) {
        // Clear it for the next one
        setContent('')
        setCategory(null)
      }
    } finally {
      // Back in the reviewer's hands, landed or not
      setIsSubmitting(false)
    }
  }

  // What the note says, and the ways to change it or be done with it
  return { content, setContent, category, setCategory, hasChanged, isSubmitting, submit }
}
