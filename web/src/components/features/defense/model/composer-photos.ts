import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * What every photo held in the composer carries.
 */
type HeldPhoto = {
  /** The photo, unique among those the composer has held. */
  id: number
  /** Where the photo previews from: the student's own device, or its stored page once that copy is gone. */
  previewUrl: string
}

/**
 * A photo whose reading is on its way.
 */
export type ReadingPhoto = HeldPhoto & {
  /** The discriminant. */
  kind: 'reading'
}

/**
 * What every photo the API has read and kept carries.
 */
type KeptPhoto = HeldPhoto & {
  /** The kept photo. */
  photoId: string
  /** Where the kept page loads from, for as long as its link lasts. */
  link: string
}

/**
 * A photo that has been read, its text waiting beside it for the student to check before it goes into the message.
 */
type ReadPhoto = KeptPhoto & {
  /** The discriminant. */
  kind: 'read'
  /** The page's text as the student has left it. */
  text: string
}

/**
 * A photo whose text has gone into the message, where it is edited from then on.
 */
export type InsertedPhoto = KeptPhoto & {
  /** The discriminant. */
  kind: 'inserted'
  /** Whether it went out with a message still on its way, out of the composer until that lands or fails. */
  isGoingOut: boolean
}

/**
 * A photo the reading failed on, which can be read again unless the photo itself is why.
 */
type FailedPhoto = HeldPhoto & {
  /** The discriminant. */
  kind: 'failed'
  /** Why the reading failed, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
}

/**
 * A photo of the student's handwritten work, held in the composer.
 */
export type ComposerPhoto = ReadingPhoto | ReadPhoto | InsertedPhoto | FailedPhoto
