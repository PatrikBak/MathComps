import type { AppErrorCode } from '@/lib/api/api-error-codes'
import type { ApiResult } from '@/types/api'

import type { DefensePhotoReading } from './defense-types'

/**
 * The largest photo sent to be read, in megabytes. It sits under the API's cap on a request's body, 30,000,000 bytes,
 * which a photo past it never gets through.
 */
export const MAX_PHOTO_SIZE_MB = 28

/**
 * The failures that come out the same however often the photo is read again.
 */
const FINAL_FAILURES: readonly AppErrorCode[] = ['UnreadablePhoto', 'FILE_TOO_LARGE']

/**
 * Says whether reading a photo again could come out differently from the reading that failed.
 *
 * @param errorCode - Why the reading failed, or undefined when nothing said why.
 *
 * @returns Whether another reading is worth offering.
 */
export function canReadAgain(errorCode: AppErrorCode | undefined): boolean {
  // Anything but a failure the photo itself causes can go another way next time
  return errorCode === undefined || !FINAL_FAILURES.includes(errorCode)
}

/**
 * What every held photo carries.
 */
export type HeldPhoto = {
  /** The photo, unique among those held. */
  id: number
  /** Where the photo previews from: the student's own device, or its stored page once that copy is gone. */
  previewUrl: string
}

/**
 * What every photo whose text has yet to go into the message carries, a page from the phone taking its place among
 * them by when it was taken.
 */
type WaitingPhoto = HeldPhoto & {
  /** When the photo was taken, in milliseconds since the epoch. */
  capturedAt: number
}

/**
 * A photo whose reading is on its way.
 */
export type ReadingPhoto = WaitingPhoto & {
  /** The discriminant. */
  kind: 'reading'
}

/**
 * A photo that has been read, holding what it read as beside the page's text.
 *
 * @template TReading - What the API reads a photo as.
 */
export type ReadPhoto<TReading> = WaitingPhoto & {
  /** The discriminant. */
  kind: 'read'
  /** What the photo read as, with the page's text as it stood when the photo came in. */
  reading: TReading
  /** The page's text, as read or as the student has changed it since. */
  text: string
}

/**
 * Builds a read photo previewing from its stored page, its text waiting beside it.
 *
 * @param id - The photo's id among those held.
 * @param reading - What the photo read as, with the page's text as it now stands.
 * @param capturedAt - When the photo was taken, in milliseconds since the epoch.
 *
 * @returns The photo, its text still to go into the message.
 */
export function readPhotoOf(
  id: number,
  reading: DefensePhotoReading,
  capturedAt: number
): ReadPhoto<DefensePhotoReading> {
  // Previewing from its stored page, what it read as kept beside the page's text
  return {
    kind: 'read',
    id,
    previewUrl: reading.link,
    capturedAt,
    reading: { photoId: reading.photoId, link: reading.link, text: reading.text },
    text: reading.text,
  }
}

/**
 * A photo whose text has gone into the message, where it is edited from then on.
 */
export type InsertedPhoto = HeldPhoto &
  Pick<DefensePhotoReading, 'photoId' | 'link'> & {
    /** The discriminant. */
    kind: 'inserted'
    /** Whether it went out with a message still on its way, out of the composer until that lands or fails. */
    isGoingOut: boolean
  }

/**
 * Builds a photo whose text is in the message from its stored page, which it previews from.
 *
 * @param id - The photo's id among those held.
 * @param photoId - The kept photo.
 * @param link - Where the kept page loads from.
 *
 * @returns The photo, staying in the composer.
 */
export function insertedPhotoOf(id: number, photoId: string, link: string): InsertedPhoto {
  // Previewing from its stored page, with no message of its own on the way
  return { kind: 'inserted', id, previewUrl: link, photoId, link, isGoingOut: false }
}

/**
 * A photo the reading failed on, which can be read again unless the photo itself is why.
 */
type FailedPhoto = WaitingPhoto & {
  /** The discriminant. */
  kind: 'failed'
  /** Why the reading failed, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
}

/**
 * A photo of the student's handwritten work picked on this device, by where its reading stands.
 *
 * @template TReading - What the API reads a photo as.
 */
export type PickedPhoto<TReading extends DefensePhotoReading> =
  | ReadingPhoto
  | ReadPhoto<TReading>
  | FailedPhoto

/**
 * A photo of the student's handwritten work: one picked on this device, wherever its reading stands, or one whose
 * text is in the message.
 */
export type DefensePhoto = PickedPhoto<DefensePhotoReading> | InsertedPhoto

/**
 * A photo on its way to be read.
 */
export type PhotoReadRequest = {
  /** The photo as it goes up, shrunk to the size it is read at where it could be. */
  photo: Blob
  /** When the photo was taken, as far as the device knows. */
  capturedAt: Date
  /** Aborts the read. */
  signal: AbortSignal
}

/**
 * Sends a photo to be read, settling into what it read as.
 *
 * @template TReading - What the API reads a photo as.
 *
 * @param request - The photo, when it was taken, and what aborts its read.
 *
 * @returns The settled read.
 */
export type PhotoReader<TReading extends DefensePhotoReading> = (
  request: PhotoReadRequest
) => Promise<ApiResult<TReading>>
