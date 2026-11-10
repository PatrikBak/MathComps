'use client'

import 'yet-another-react-lightbox/styles.css'

import { Portal } from '@headlessui/react'
import { useFocusReturn } from '@mantine/hooks'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import type { Labels, SlideImage } from 'yet-another-react-lightbox'
import Lightbox from 'yet-another-react-lightbox'
import Zoom from 'yet-another-react-lightbox/plugins/zoom'

/**
 * One photo the viewer shows.
 */
export type ViewerPhoto = {
  /** Where the photo loads from. */
  src: string
  /** What the photo shows, for readers who can't see it. */
  alt: string
}

/**
 * Whether the viewer's slides show the photos: the same images under the same names, in the same order.
 *
 * @param slides - The slides the viewer holds.
 * @param photos - The photos the viewer is to show.
 *
 * @returns Whether the slides show exactly those photos.
 */
function showsPhotos(slides: readonly SlideImage[], photos: readonly ViewerPhoto[]): boolean {
  // As many slides as photos, each one the photo at its place
  return (
    slides.length === photos.length &&
    photos.every(
      (photo, position) =>
        slides[position]?.src === photo.src && slides[position]?.alt === photo.alt
    )
  )
}

/**
 * Props for the {@link PhotoViewer}.
 */
type PhotoViewerProps = {
  /** The photos, in the order they are swiped through. */
  photos: readonly ViewerPhoto[]
  /** Where the photo shown stands among the photos, from 0. */
  index: number
  /** Whether the viewer is open. */
  isOpen: boolean
  /** Called with where the photo swiped to stands among the photos. */
  onIndexChange: (index: number) => void
  /** Shuts the viewer. */
  onClose: () => void
}

/**
 * Photos over the whole screen, one at a time, swiped between, zoomed with a pinch or a double tap and dragged around
 * once zoomed.
 *
 * Opened inside a dialog it counts as that dialog's own content: the portal it mounts through is the dialog's, so a
 * press on the viewer is no press outside the dialog. An Escape shuts only the viewer, which keeps the key from
 * reaching the dialog.
 */
export function PhotoViewer({ photos, index, isOpen, onIndexChange, onClose }: PhotoViewerProps) {
  // Copy for the viewer
  const t = useTranslations('ui.photoViewer')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // Where the viewer mounts
  const rootRef = useRef<HTMLDivElement>(null)

  // The focus goes back where it was once the viewer shuts
  useFocusReturn({ opened: isOpen })

  // While the viewer is open, the content it opened over is shut to the keyboard and to screen readers. The library
  // shuts only what sits beside the viewer in the element it mounts into, and that element holds the viewer alone
  useEffect(() => {
    // The viewer's portal, and what holds it beside the content it opened over
    const portal = rootRef.current?.parentElement
    const host = portal?.parentElement

    // Nothing to shut while the viewer is shut, or before it is mounted
    if (!isOpen || !portal || !host) return

    // Everything beside the viewer, leaving out what something else has shut already
    const shut = [...host.children].filter(
      (element) => element !== portal && !element.hasAttribute('inert')
    )

    // Shut while the viewer is open
    shut.forEach((element) => element.setAttribute('inert', ''))

    // Open again once the viewer shuts
    return () => shut.forEach((element) => element.removeAttribute('inert'))
  }, [isOpen])

  // Every label the viewer reads, the slide counter left raw for the viewer to fill
  const labels = {
    Close: tActions('close'),
    Previous: t('previous'),
    Next: t('next'),
    'Zoom in': t('zoomIn'),
    'Zoom out': t('zoomOut'),
    Lightbox: t('viewer'),
    'Photo gallery': t('photos'),
    Carousel: t('carousel'),
    Slide: t('slide'),
    '{index} of {total}': t.raw('slideCounter'),
  } satisfies Required<Labels>

  // The photos as the viewer's slides, one array for as long as the photos stay the same. The viewer goes back to
  // the photo `index` names whenever it is handed a new array, and `index` catches up with a swipe only after
  // `on.view`, so a page render landing together with a swipe would undo the swipe
  const [slides, setSlides] = useState<SlideImage[]>([])

  // A new array once the photos change
  if (!showsPhotos(slides, photos)) setSlides(photos.map(({ src, alt }) => ({ src, alt })))

  // The viewer in the portal of whatever dialog it is opened from
  return (
    <Portal>
      <div ref={rootRef}>
        <Lightbox
          open={isOpen}
          close={onClose}
          index={index}
          slides={slides}
          plugins={[Zoom]}
          labels={labels}
          portal={{ root: () => rootRef.current }}
          // Swiping stops at the first photo and at the last
          carousel={{ finite: true }}
          // A tap beside the photo or a swipe down shuts the viewer
          controller={{ closeOnBackdropClick: true, closeOnPullDown: true }}
          // The viewer's own scroll lock shrinks the page to the screen, which loses the reader's place in it, so
          // the page keeps the lock of the dialog it is opened from
          noScroll={{ disabled: true }}
          on={{ view: ({ index: viewed }) => onIndexChange(viewed) }}
          // The viewer's buttons only lighten on focus, so a keyboard reader gets the app's ring
          className="[&_.yarl__button]:rounded-md [&_.yarl__button:focus-visible]:ring-2 [&_.yarl__button:focus-visible]:ring-focus"
        />
      </div>
    </Portal>
  )
}
