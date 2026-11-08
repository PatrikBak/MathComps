'use client'

import { useDisclosure } from '@mantine/hooks'
import { useTranslations } from 'next-intl'

import type { ViewerPhoto } from '@/components/shared/components/PhotoViewer'

import type { UseDefensePhotosResult } from './use-defense-photos'

/**
 * Options for {@link useDefensePhotoViewer}.
 */
type UseDefensePhotoViewerOptions = {
  /** The composer's photos and what can be done with them. */
  photos: UseDefensePhotosResult
  /** Looks at a photo in the review, given its id. */
  onView: (id: number) => void
}

/**
 * The review's pages shown large over the whole screen, and the ways in and out.
 */
export type UseDefensePhotoViewerResult = {
  /** Whether the pages are shown large. */
  isEnlarged: boolean
  /** Shows the pages large, from the one looked at. */
  enlarge: () => void
  /** Takes the pages back to the review. */
  shrink: () => void
  /** Every page as it is shown large, in page order. */
  viewerPhotos: readonly ViewerPhoto[]
  /** Looks at the page swiped to in the review too, given where it stands among the photos, from 0. */
  viewSwipedTo: (index: number) => void
}

/**
 * Shows the review's pages large, the review following the page swiped to so its text is there on the way back.
 *
 * @param options - The composer's photos and how the review looks at one.
 *
 * @returns Whether the pages are large, the ways in and out, and the pages as they are shown.
 */
export function useDefensePhotoViewer({
  photos,
  onView,
}: UseDefensePhotoViewerOptions): UseDefensePhotoViewerResult {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // Whether the pages are shown large
  const [isEnlarged, { open: enlarge, close: shrink }] = useDisclosure(false)

  // Every page as it is shown large, named by its place
  const viewerPhotos = photos.photos.map((photo, index) => ({
    src: photo.previewUrl,
    alt: t('photo', { number: index + 1 }),
  }))

  // A function which looks at the page swiped to in the review too
  const viewSwipedTo = (index: number) => {
    // The page swiped to, if one stands there
    const swipedTo = photos.photos.at(index)

    // Looked at in the review
    if (swipedTo !== undefined) onView(swipedTo.id)
  }

  // Whether the pages are large, the ways in and out, and the pages as they are shown
  return { isEnlarged, enlarge, shrink, viewerPhotos, viewSwipedTo }
}
