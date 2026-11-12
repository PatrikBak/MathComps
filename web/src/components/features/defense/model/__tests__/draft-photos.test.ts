import { describe, expect, it } from 'vitest'

import { readDraftPhotos, writeDraftPhotos } from '../draft-photos'
import type { DefensePhoto, InsertedPhoto } from '../photo-reading'

/**
 * A photo whose text went into the message.
 *
 * @param id - The photo among those held.
 * @param photoId - The kept photo.
 * @param isGoingOut - Whether it went out with a message still on its way.
 *
 * @returns The photo, previewing from its stored page.
 */
function inserted(id: number, photoId: string, isGoingOut: boolean): InsertedPhoto {
  // Its stored page, named after it
  const link = `https://files.example/${photoId}.jpg`

  // In the message, previewing from that page
  return { kind: 'inserted', id, previewUrl: link, photoId, link, isGoingOut }
}

/**
 * Builds a function which hands out photo ids from 0 up, never the same one twice.
 *
 * @returns The function.
 */
function countingIds(): () => number {
  // The id the next photo gets
  let upcoming = 0

  // Each call hands out that id and moves past it
  return () => upcoming++
}

describe('writeDraftPhotos', () => {
  it('keeps the photos in the message and those read beside it, in page order', () => {
    // A page in the message, one read and corrected by the student, one on its way out with a message, another in
    // the message, one being read and one the reading failed on
    const held: readonly DefensePhoto[] = [
      inserted(0, 'photo-1', false),
      {
        kind: 'read',
        id: 1,
        previewUrl: 'blob:photo-2',
        reading: {
          photoId: 'photo-2',
          link: 'https://files.example/photo-2.jpg',
          text: 'Let $n$ be odd.',
        },
        capturedAt: 1_700_000_000_000,
        text: 'Let $n$ be even.',
      },
      inserted(2, 'photo-3', true),
      inserted(3, 'photo-4', false),
      { kind: 'reading', id: 4, previewUrl: 'blob:photo-5', capturedAt: 0 },
      { kind: 'failed', id: 5, previewUrl: 'blob:photo-6', capturedAt: 0, errorCode: undefined },
    ]

    // Written and read back after a reload, the ids handed out afresh
    const read = readDraftPhotos(writeDraftPhotos(held), countingIds())

    // The two in the message, and between them the read one with the student's text and its capture time, each
    // previewing from its stored page
    expect(read).toEqual([
      inserted(0, 'photo-1', false),
      {
        kind: 'read',
        id: 1,
        previewUrl: 'https://files.example/photo-2.jpg',
        reading: {
          photoId: 'photo-2',
          link: 'https://files.example/photo-2.jpg',
          text: 'Let $n$ be even.',
        },
        capturedAt: 1_700_000_000_000,
        text: 'Let $n$ be even.',
      },
      inserted(2, 'photo-4', false),
    ])
  })
})

describe('readDraftPhotos', () => {
  it('reads anything but a list of kept photos as none', () => {
    // What a browser can be left holding: text that isn't JSON, the wrong JSON, a photo kept with no kind, photos
    // missing what they need, a read photo whose capture time is no number, and a kind no photo has
    const leftovers = [
      'not json',
      '"a draft"',
      '{}',
      '[{"photoId":"photo-1","link":"x"}]',
      '[{"kind":"inserted","photoId":"photo-1"}]',
      '[{"kind":"inserted","photoId":1,"link":"x"}]',
      '[{"kind":"read","photoId":"photo-1","link":"x","text":"t"}]',
      '[{"kind":"read","photoId":"photo-1","link":"x","text":"t","capturedAt":"2026-11-11"}]',
      '[{"kind":"reading","photoId":"photo-1","link":"x"}]',
    ]

    // Each reads as no photos rather than throwing
    leftovers.forEach((stored) => expect(readDraftPhotos(stored, countingIds())).toEqual([]))
  })
})
