import { describe, expect, it } from 'vitest'

import type { DefensePhotoReading } from '../defense-types'
import { placeByCaptureTime } from '../photo-order'
import type { DefensePhoto, ReadingPhoto, ReadPhoto } from '../photo-reading'

/**
 * A photo read and waiting beside its text, which every page from the phone arrives as.
 *
 * @param name - Which page it is, which it previews from too.
 * @param capturedAt - When it was taken.
 *
 * @returns The photo.
 */
function read(name: string, capturedAt: number): ReadPhoto<DefensePhotoReading> {
  // What it read as, no text to it
  const reading = { photoId: name, link: name, text: '' }

  // Read, its text not in the message yet
  return { kind: 'read', id: 0, previewUrl: name, capturedAt, reading, text: '' }
}

/**
 * A photo still being read.
 *
 * @param name - Which page it is, which it previews from too.
 * @param capturedAt - When it was taken.
 *
 * @returns The photo.
 */
function reading(name: string, capturedAt: number): ReadingPhoto {
  // On its way to be read
  return { kind: 'reading', id: 0, previewUrl: name, capturedAt }
}

/**
 * A photo the reading failed on.
 *
 * @param name - Which page it is, which it previews from too.
 * @param capturedAt - When it was taken.
 *
 * @returns The photo.
 */
function failed(name: string, capturedAt: number): DefensePhoto {
  // Failed, for no reason the API gave
  return { kind: 'failed', id: 0, previewUrl: name, capturedAt, errorCode: undefined }
}

/**
 * A photo whose text is in the message.
 *
 * @param name - Which page it is, which it previews from too.
 *
 * @returns The photo.
 */
function inserted(name: string): DefensePhoto {
  // In the message, held where it stands
  return { kind: 'inserted', id: 0, previewUrl: name, photoId: name, link: name, isGoingOut: false }
}

/**
 * Places arrived pages among held photos, handing back the order they end in.
 *
 * @param held - The photos held, in page order.
 * @param arrived - The pages that have just arrived.
 *
 * @returns The photos' names in page order.
 */
function place(
  held: readonly DefensePhoto[],
  arrived: readonly ReadPhoto<DefensePhotoReading>[]
): readonly string[] {
  // The photos placed
  const placed = placeByCaptureTime(held, arrived)

  // Their order, each named by what it previews from
  return placed.map((photo) => photo.previewUrl)
}

describe('placeByCaptureTime', () => {
  it('puts pages ahead of later photos the reading failed on or is still on', () => {
    // Two pages photographed before those, one before each
    const order = place(
      [failed('second', 200), reading('fourth', 400)],
      [read('first', 100), read('third', 300)]
    )

    // Each lands ahead of the photo taken after it
    expect(order).toEqual(['first', 'second', 'third', 'fourth'])
  })

  it('never puts a page in front of one whose text is in the message, however early it was taken', () => {
    // A page taken before every held photo, one of them already in the message
    const order = place([inserted('sent'), read('later', 300)], [read('early', 100)])

    // Goes in front of the waiting page alone
    expect(order).toEqual(['sent', 'early', 'later'])
  })

  it('ends in the order the pages were taken when they arrive out of it over two hand-overs', () => {
    // The third page and the first arrive together, in that order
    const first = placeByCaptureTime([], [read('third', 300), read('first', 100)])

    // The second page arrives after them
    const order = place(first, [read('second', 200)])

    // Every page in the order it was taken
    expect(order).toEqual(['first', 'second', 'third'])
  })

  it('puts a page taken at the same moment as a held one after it', () => {
    // Two photos stamped with the same instant
    const order = place([read('held', 100), read('later', 200)], [read('arrived', 100)])

    // The held one keeps its place in front
    expect(order).toEqual(['held', 'arrived', 'later'])
  })
})
