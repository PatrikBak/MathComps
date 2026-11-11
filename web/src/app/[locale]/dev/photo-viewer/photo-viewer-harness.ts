import type { ViewerPhoto } from '@/components/shared/components/PhotoViewer'

/** The photos each viewer on the page swipes through, in order. */
export const HARNESS_PHOTOS: readonly ViewerPhoto[] = [
  { src: '/dev-placeholders/inline-1.svg', alt: 'Photo 1' },
  { src: '/dev-placeholders/inline-2.svg', alt: 'Photo 2' },
  { src: '/dev-placeholders/inline-A.svg', alt: 'Photo 3' },
]

/** The page's own words, which read the same in every locale. */
export const HARNESS_COPY = {
  /** The heading over the photos opened straight from the page. */
  pageSection: 'On the page',
  /** The button opening the dialog. */
  openDialog: 'Open the dialog',
  /** The title of the dialog holding photos of its own. */
  dialogTitle: 'Photos in a dialog',
  /**
   * The name of a photo's tile, which opens the viewer on that photo.
   *
   * @param number - Where the photo stands among the photos, from 1.
   *
   * @returns The tile's name.
   */
  openPhoto: (number: number) => `Open photo ${number}`,
}
