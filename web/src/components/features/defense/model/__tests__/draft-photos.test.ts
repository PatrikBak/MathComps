import { describe, expect, it } from 'vitest'

import type { ComposerPhoto, InsertedPhoto } from '../composer-photos'
import { readDraftPhotos, writeDraftPhotos } from '../draft-photos'

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

describe('writeDraftPhotos', () => {
  it('keeps only the photos whose text is in the message, in page order', () => {
    // A page in the message, one still being checked, one on its way out with a message, another in the message,
    // one being read and one the reading failed on
    const held: readonly ComposerPhoto[] = [
      inserted(0, 'photo-1', false),
      {
        kind: 'read',
        id: 1,
        previewUrl: 'blob:photo-2',
        photoId: 'photo-2',
        link: 'https://files.example/photo-2.jpg',
        text: 'Let $n$ be odd.',
      },
      inserted(2, 'photo-3', true),
      inserted(3, 'photo-4', false),
      { kind: 'reading', id: 4, previewUrl: 'blob:photo-5' },
      { kind: 'failed', id: 5, previewUrl: 'blob:photo-6', errorCode: undefined },
    ]

    // Written and read back
    const read = readDraftPhotos(writeDraftPhotos(held))

    // The two in the message, the first ahead of the other
    expect(read).toEqual([
      { photoId: 'photo-1', link: 'https://files.example/photo-1.jpg' },
      { photoId: 'photo-4', link: 'https://files.example/photo-4.jpg' },
    ])
  })
})

describe('readDraftPhotos', () => {
  it('reads anything but a list of kept photos as none', () => {
    // What a browser can be left holding: text that isn't JSON, the wrong JSON, and photos missing what they need
    const leftovers = [
      'not json',
      '"a draft"',
      '{}',
      '[{"photoId":"photo-1"}]',
      '[{"photoId":1,"link":"x"}]',
    ]

    // Each reads as no photos rather than throwing
    leftovers.forEach((stored) => expect(readDraftPhotos(stored)).toEqual([]))
  })
})
