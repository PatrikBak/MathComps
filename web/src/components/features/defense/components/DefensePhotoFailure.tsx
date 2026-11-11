'use client'

import { TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import type { AppErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import { canReadAgain, MAX_PHOTO_SIZE_MB } from '../model/photo-reading'

/**
 * Props for the {@link DefensePhotoFailure}.
 */
type DefensePhotoFailureProps = {
  /** Which photo failed, counting from 1, for a note shown apart from its photo, or null for one shown beside it. */
  photoNumber: number | null
  /** Why the reading failed, or undefined when nothing said why. */
  errorCode: AppErrorCode | undefined
  /** Reads the photo again. */
  onRetry: () => void
  /** Drops the photo. */
  onRemove: () => void
}

/**
 * What a photo whose reading failed says: the mark its tile carries too, why, and the way on, which is another go
 * where one could come out differently and the photo's removal where none could. It brings no box of its own, so
 * each surface lays its pieces out where they stand.
 */
export function DefensePhotoFailure({
  photoNumber,
  errorCode,
  onRetry,
  onRemove,
}: DefensePhotoFailureProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // Why, in words, or the generic failure where nothing said why. The size cap goes along for the copy that names it
  const why = resolveErrorMessage(errorCode, tApiErrors, {
    fallback: t('readError'),
    data: { max: MAX_PHOTO_SIZE_MB },
  })

  // The mark, why, and the way on
  return (
    <>
      {/* The mark the photo's tile carries too */}
      <TriangleAlert className="size-5 text-error" aria-hidden="true" />

      {/* Which photo, when the note stands apart from it, and why, heard as it comes, in the foreground since the
          error red is too faint for small text */}
      <div role="alert" className="min-w-0 text-foreground">
        {photoNumber !== null && (
          <p className="font-medium">{t('photo', { number: photoNumber })}</p>
        )}
        <p className="text-balance">{why}</p>
      </div>

      {/* The way on, by whether another reading could come out differently */}
      {canReadAgain(errorCode) ? (
        // Another go
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tActions('retry')}
        </Button>
      ) : (
        // The photo's removal, no reading of it coming out any other way
        <Button variant="secondary" size="sm" onClick={onRemove}>
          {t('remove')}
        </Button>
      )}
    </>
  )
}
