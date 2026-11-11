import type { AppErrorCode } from '@/lib/api/api-error-codes'

/**
 * The student's code on its way, pointed at what they are defending.
 */
type PointingPhotoHandoff = {
  /** The discriminant. */
  kind: 'pointing'
}

/**
 * The code that never came, which another try may bring.
 */
type FailedPhotoHandoff = {
  /** The discriminant. */
  kind: 'failed'
  /** Why it never came, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
}

/**
 * The student's live code, pointed at what they are defending.
 */
type PointedPhotoHandoff = {
  /** The discriminant. */
  kind: 'pointed'
  /** The secret the phone sends its photos by. */
  code: string
}

/**
 * The state of the code the student's phone sends photos with.
 */
export type DefensePhotoHandoff = PointingPhotoHandoff | FailedPhotoHandoff | PointedPhotoHandoff
