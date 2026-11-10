'use client'

import { useDisclosure } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import type { ViewerPhoto } from '@/components/shared/components/PhotoViewer'

/**
 * Options for {@link useDefensePhotoViewer}.
 */
type UseDefensePhotoViewerOptions = {
  /** Where each image loads from, in order. */
  links: readonly string[]
  /** What the images are, which names each one together with its place. */
  item: 'photo' | 'drawing'
  /** Follows the image swiped to, given where it stands among the images, from 0; absent where nothing follows it. */
  onSwipe?: (index: number) => void
}

/**
 * Images of handwritten work shown large over the whole screen, and the ways in and out.
 */
export type UseDefensePhotoViewerResult = {
  /** Whether the images are shown large. */
  isOpen: boolean
  /** Where the image shown stands among the images, from 0. */
  index: number
  /** Every image as it is shown large, in order. */
  viewerPhotos: readonly ViewerPhoto[]
  /** Shows the images large, from the one standing at the given place, from 0. */
  openAt: (index: number) => void
  /** Moves to the image swiped to, given where it stands, from 0. */
  swipeTo: (index: number) => void
  /** Takes the images back. */
  close: () => void
}

/**
 * Shows images of handwritten work large, its pages or the drawings cut out of them, swiped through from
 * whichever one was pressed.
 *
 * @param options - The images, what they are, and what follows the one swiped to.
 *
 * @returns Whether the images are large, which one is shown, the images as they are shown, and the ways in and
 * out.
 */
export function useDefensePhotoViewer({
  links,
  item,
  onSwipe,
}: UseDefensePhotoViewerOptions): UseDefensePhotoViewerResult {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // Whether the images are shown large
  const [isOpen, { open, close }] = useDisclosure(false)

  // Where the image shown stands, kept past a close so the viewer doesn't jump while it fades out
  const [index, setIndex] = useState(0)

  // Every image as it is shown large, named by its place
  const viewerPhotos = links.map((link, position) => ({
    src: link,
    alt: t(item, { number: position + 1 }),
  }))

  // A function which shows the images large from the one pressed
  const openAt = (start: number) => {
    // The image pressed is the one shown
    setIndex(start)

    // The images over the whole screen
    open()
  }

  // A function which moves to the image swiped to
  const swipeTo = (swipedTo: number) => {
    // The image swiped to is the one shown
    setIndex(swipedTo)

    // Whatever follows the swipes hears which image was reached
    onSwipe?.(swipedTo)
  }

  // Whether the images are large, which one is shown, the images as they are shown, and the ways in and out
  return { isOpen, index, viewerPhotos, openAt, swipeTo, close }
}
