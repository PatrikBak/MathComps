import { assertNever } from '@/components/shared/utils/assert-never'

import { defenseTargetKey, toSessionTarget } from './defense-target'
import type { HandoffPhotoReading, NamedDefenseTarget } from './defense-types'
import type { PickedPhoto } from './photo-reading'

/**
 * A photo sent from a phone through a handoff code.
 */
export type HandoffPhoto = PickedPhoto<HandoffPhotoReading>

/**
 * The photos a phone sent to one problem.
 */
type HandoffPhotoGroup = {
  /** The problem. */
  target: NamedDefenseTarget
  /** Its photos, in page order. */
  photos: readonly HandoffPhoto[]
}

/**
 * A phone's photos, sorted under the problems they went to.
 */
type HandoffPhotoGroups = {
  /** The photos standing under the problem photos go to now, in page order. */
  current: readonly HandoffPhoto[]
  /** Every other problem the phone sent photos to, by their latest photo, newest first. */
  earlier: readonly HandoffPhotoGroup[]
}

/**
 * A photo beside the problem it stands under.
 */
type PlacedPhoto = {
  /** The photo. */
  photo: HandoffPhoto
  /** Where it stands among all the phone's photos, in page order. */
  index: number
  /** The problem it stands under. */
  target: NamedDefenseTarget
}

/**
 * Names a problem by its ids alone, so two namings of one problem land together.
 *
 * @param target - The problem.
 *
 * @returns The key.
 */
function keyOf(target: NamedDefenseTarget): string {
  // The key a defense of it is opened under
  return defenseTargetKey(toSessionTarget(target))
}

/**
 * Which problem a photo stands under: a read one under the problem the API sent it to, and any other under the
 * problem photos go to now. One still being read stands there until its read says where it went, since the phone
 * cannot know whether the API took it before or after the code moved; a failed one, since reading it again sends it
 * there.
 *
 * @param photo - The photo.
 * @param current - The problem photos go to now.
 *
 * @returns The problem it stands under.
 */
function placeOf(photo: HandoffPhoto, current: NamedDefenseTarget): NamedDefenseTarget {
  // By where the photo's reading stands
  switch (photo.kind) {
    // The API said where it went
    case 'read':
      return photo.reading.target

    // Nothing says where it went, so it stands with the photos going out now
    case 'reading':
    case 'failed':
      return current

    // Every state is handled above
    default:
      return assertNever(photo)
  }
}

/**
 * Sorts a phone's photos under the problems they went to, each problem's photos in page order.
 *
 * @param photos - The phone's photos, in page order.
 * @param current - The problem photos go to now.
 *
 * @returns The current problem's photos, and every other problem's.
 */
export function groupHandoffPhotos(
  photos: readonly HandoffPhoto[],
  current: NamedDefenseTarget
): HandoffPhotoGroups {
  // The problem photos go to now, by its ids
  const currentKey = keyOf(current)

  // Each photo beside the problem it stands under
  const placed = photos.map(
    (photo, index): PlacedPhoto => ({ photo, index, target: placeOf(photo, current) })
  )

  // Every other problem the photos stand under, once each
  const earlierKeys = [...new Set(placed.map((entry) => keyOf(entry.target)))].filter(
    (key) => key !== currentKey
  )

  // Each of those problems' photos in page order, at least one each, since each problem came from one
  const earlier = earlierKeys.map((key) => placed.filter((entry) => keyOf(entry.target) === key))

  // A function which picks a problem's latest photo
  const latestOf = (group: readonly PlacedPhoto[]) => group[group.length - 1]

  // The other problems, by their latest photo, newest first
  const newestFirst = earlier.toSorted(
    (first, second) => latestOf(second).index - latestOf(first).index
  )

  // Each other problem, named as its latest photo names it, with its photos
  const earlierGroups = newestFirst.map(
    (group): HandoffPhotoGroup => ({
      target: latestOf(group).target,
      photos: group.map((entry) => entry.photo),
    })
  )

  // The photos standing under the problem photos go to now
  const currentPhotos = placed
    .filter((entry) => keyOf(entry.target) === currentKey)
    .map((entry) => entry.photo)

  // The current problem's photos, and the others'
  return { current: currentPhotos, earlier: earlierGroups }
}
