'use client'

import type { RefObject } from 'react'
import { useState } from 'react'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'

import type { UseComposerPhotosResult } from './use-composer-photos'

/**
 * Options for {@link useDefensePhotoReview}.
 */
type UseDefensePhotoReviewOptions = {
  /** The composer's photos and what can be done with them. */
  photos: UseComposerPhotosResult
  /** The composer's handle. */
  editorRef: RefObject<RichMathEditorRef | null>
}

/**
 * The review of the composer's photos, where each page's text is checked before it goes into the message, and the
 * ways into it.
 */
export type UseDefensePhotoReviewResult = {
  /** The photo looked at in the review, or null while the review is shut. */
  viewedPhotoId: number | null
  /** Looks at a photo, opening the review on it while it is shut. */
  view: (id: number) => void
  /** Shuts the review. */
  close: () => void
  /** Takes newly picked photos, opening the review on the first of them. */
  pick: (files: readonly File[]) => void
}

/**
 * Opens and shuts the review of the composer's photos. Picking photos, from the composer or from the review itself,
 * starts their reading and looks at the first of them.
 *
 * @param options - The composer's photos and its handle.
 *
 * @returns The photo looked at, and the ways into and out of the review.
 */
export function useDefensePhotoReview({
  photos,
  editorRef,
}: UseDefensePhotoReviewOptions): UseDefensePhotoReviewResult {
  // The photo looked at, null while the review is shut
  const [viewedPhotoId, setViewedPhotoId] = useState<number | null>(null)

  // A photo dropped while it was looked at hands the view to the first page, and the last one dropped shuts it
  if (viewedPhotoId !== null && !photos.photos.some((photo) => photo.id === viewedPhotoId)) {
    setViewedPhotoId(photos.photos.at(0)?.id ?? null)
  }

  // Looks at a photo
  const view = (id: number) => setViewedPhotoId(id)

  // Shuts the review
  const close = () => setViewedPhotoId(null)

  // Takes picked photos, looking at the first of them straight away
  const pick = (files: readonly File[]) => {
    // The expanded editor makes way, the photos being picked from it too
    editorRef.current?.collapse()

    // The photos start reading
    const [first] = photos.addPhotos(files)

    // And the first of them is looked at
    if (first !== undefined) setViewedPhotoId(first)
  }

  // The photo looked at, and the ways into and out of the review
  return { viewedPhotoId, view, close, pick }
}
