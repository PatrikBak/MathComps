import { describe, expect, it } from 'vitest'

import type { NamedDefenseTarget } from '../defense-types'
import type { HandoffPhoto } from '../photo-handoff'
import { groupHandoffPhotos } from '../photo-handoff'

/** A handout problem a code pointed at first. */
const HANDOUT: NamedDefenseTarget = {
  kind: 'handout',
  handoutContentId: 'inverses-mod-p',
  environmentId: 'ab12cd34',
}

/** The proposed problem the code points at now. */
const PROPOSAL: NamedDefenseTarget = {
  kind: 'proposal',
  problemId: 'p-2',
  organizationSlug: 'olympiad',
  slug: 'p-2',
  number: 7,
  title: 'Two circles',
}

/** Another proposed problem. */
const OTHER_PROPOSAL: NamedDefenseTarget = { ...PROPOSAL, problemId: 'p-3', slug: 'p-3', number: 8 }

/** A third proposed problem. */
const THIRD_PROPOSAL: NamedDefenseTarget = { ...PROPOSAL, problemId: 'p-4', slug: 'p-4', number: 9 }

/**
 * A photo the API read and sent to a problem.
 *
 * @param id - The photo.
 * @param target - The problem it went to.
 *
 * @returns The photo.
 */
function readPhoto(id: number, target: NamedDefenseTarget): HandoffPhoto {
  // Read, its answer naming where it went
  return {
    kind: 'read',
    id,
    previewUrl: `blob:${id}`,
    reading: {
      photoId: `photo-${id}`,
      link: `https://files.example/photo-${id}.jpg`,
      text: '',
      target,
    },
    text: '',
  }
}

/**
 * A photo still on its way to be read.
 *
 * @param id - The photo.
 *
 * @returns The photo.
 */
function readingPhoto(id: number): HandoffPhoto {
  // Nothing answered yet
  return { kind: 'reading', id, previewUrl: `blob:${id}` }
}

/**
 * A photo the reading failed on.
 *
 * @param id - The photo.
 *
 * @returns The photo.
 */
function failedPhoto(id: number): HandoffPhoto {
  // Failed with no reason given
  return { kind: 'failed', id, previewUrl: `blob:${id}`, errorCode: undefined }
}

/**
 * The ids of a list of photos.
 *
 * @param photos - The photos.
 *
 * @returns Their ids, in order.
 */
function idsOf(photos: readonly HandoffPhoto[]): number[] {
  // Each photo's id
  return photos.map((photo) => photo.id)
}

describe('groupHandoffPhotos', () => {
  it('stands photos still being read or failed under the current problem, beside the read ones sent there', () => {
    // A page read for the proposal, one on its way and one that failed, with the proposal current
    const groups = groupHandoffPhotos(
      [readPhoto(0, PROPOSAL), readingPhoto(1), failedPhoto(2)],
      PROPOSAL
    )

    // All three under the current problem, nothing earlier
    expect(idsOf(groups.current)).toEqual([0, 1, 2])
    expect(groups.earlier).toEqual([])
  })

  it('leaves a read page under the problem it went to once the code has moved on', () => {
    // A page read for the handout, and one on its way after the code moved to the proposal
    const groups = groupHandoffPhotos([readPhoto(0, HANDOUT), readingPhoto(1)], PROPOSAL)

    // The page on its way under the proposal, the read one under the handout
    expect(idsOf(groups.current)).toEqual([1])
    expect(groups.earlier.map((group) => [group.target.kind, idsOf(group.photos)])).toEqual([
      ['handout', [0]],
    ])
  })

  it('orders earlier problems by their latest photo, newest first', () => {
    // The handout, two other proposals, the handout again, then the code moved to the proposal. Ordering by first
    // photo, newest or oldest first, gives another order than by latest
    const photos = [
      readPhoto(0, HANDOUT),
      readPhoto(1, OTHER_PROPOSAL),
      readPhoto(2, THIRD_PROPOSAL),
      readPhoto(3, HANDOUT),
      readingPhoto(4),
    ]

    // The groups, with the proposal current
    const groups = groupHandoffPhotos(photos, PROPOSAL)

    // The handout first with both its pages, then the third proposal, then the other one
    expect(groups.earlier.map((group) => idsOf(group.photos))).toEqual([[0, 3], [2], [1]])
  })

  it('counts a page as the current problem’s however the API happened to name it', () => {
    // The current proposal, named with another slug, as a read might name it
    const renamed: NamedDefenseTarget = { ...PROPOSAL, slug: 'renamed' }

    // A page read under the other naming, and one on its way under the current one
    const groups = groupHandoffPhotos([readPhoto(0, renamed), readingPhoto(1)], PROPOSAL)

    // Both pages under the current problem
    expect(idsOf(groups.current)).toEqual([0, 1])
    expect(groups.earlier).toEqual([])
  })
})
