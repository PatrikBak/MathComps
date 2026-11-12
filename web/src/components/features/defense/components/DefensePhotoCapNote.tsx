'use client'

import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

import type { UseComposerPhotosResult } from '../hooks/use-composer-photos'

/**
 * Props for the {@link DefensePhotoCapNote}.
 */
type DefensePhotoCapNoteProps = {
  /** The composer's photos and what can be done with them. */
  photos: UseComposerPhotosResult
  /** Classes for where the note stands. */
  className?: string
}

/**
 * The most photos one message may carry, said once the composer's photos reach it, which is why no more can be
 * added, and past it how many to remove.
 */
export function DefensePhotoCapNote({ photos, className }: DefensePhotoCapNoteProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // The most photos one message may carry
  const { maxPhotos } = photos

  // Nothing to say while the most a message may carry is not known, or while there is room for more
  if (maxPhotos === null || !photos.isFull) return null

  // How many photos the composer shows past the most a message may carry
  const excess = photos.photos.length - maxPhotos

  // The note, in the error colour once some photos have to go
  return (
    <p className={cn('text-sm', photos.isOverFull ? 'text-error' : 'text-muted', className)}>
      {photos.isOverFull
        ? t('overFull', { max: maxPhotos, count: excess })
        : t('full', { max: maxPhotos })}
    </p>
  )
}
