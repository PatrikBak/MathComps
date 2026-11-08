'use client'

import { useMounted } from '@mantine/hooks'
import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import type { ComposerPhoto, UseDefensePhotosResult } from '../hooks/use-defense-photos'

/**
 * The edge of a photo's tile, by where its reading stands: only a failed one is marked.
 */
const TILE_BORDER: Record<ComposerPhoto['kind'], string> = {
  reading: 'border-foreground/10',
  read: 'border-foreground/10',
  inserted: 'border-foreground/10',
  failed: 'border-error/40',
}

/**
 * Props for the {@link DefensePhotoTile}.
 */
type DefensePhotoTileProps = {
  /** The photo. */
  photo: ComposerPhoto
  /** Where it stands among the composer's photos, from 1. */
  number: number
  /** Whether it is the photo looked at in the review. */
  isSelected: boolean
  /** Looks at it in the review. */
  onOpen: () => void
  /** Reads it again. */
  onRetry: () => void
  /** Drops it from the composer. */
  onRemove: () => void
}

/**
 * One photo held in the composer, previewing from the student's device, with what its reading came to.
 */
function DefensePhotoTile({
  photo,
  number,
  isSelected,
  onOpen,
  onRetry,
  onRemove,
}: DefensePhotoTileProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // What lies over the photo, by where its reading stands
  const overlay = (() => {
    switch (photo.kind) {
      // Still being read, which the strip's status line says in words
      case 'reading':
        return (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/60">
            <Loader2 className="size-5 animate-spin text-foreground" aria-hidden="true" />
          </div>
        )

      // Read, its text beside it or already in the message, so the photo shows as it is
      case 'read':
      case 'inserted':
        return null

      // The reading failed, so the photo offers another go
      case 'failed':
        return (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/80 p-1">
            <Button
              variant="secondary"
              size="sm"
              className="pointer-events-auto min-h-0 px-1.5 py-1 text-xs leading-tight"
              onClick={onRetry}
            >
              {tActions('retry')}
            </Button>
          </div>
        )

      // Every state is handled above
      default:
        return assertNever(photo)
    }
  })()

  // The photo, named by its place so its buttons say which photo they act on
  return (
    <div role="group" aria-label={t('photo', { number })} className="relative size-20 shrink-0">
      {/* The photo under what its reading came to, clipped to the tile apart from the removal, whose focus
          ring reaches past it */}
      <div
        className={cn(
          'relative size-full overflow-hidden rounded-lg border bg-surface',
          TILE_BORDER[photo.kind],
          isSelected && 'border-brand ring-2 ring-brand/40'
        )}
      >
        <button
          type="button"
          // The tile clips, so the ring is drawn inside it
          className={cn(
            'size-full cursor-pointer',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus'
          )}
          aria-label={t('open', { number })}
          aria-current={isSelected || undefined}
          title={t('open', { number })}
          onClick={onOpen}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, nothing for a server to optimize */}
          <img src={photo.previewUrl} alt="" className="size-full object-cover" />
        </button>
        {overlay}
      </div>

      {/* Removal */}
      <Button
        variant="ghost"
        size="icon"
        shape="pill"
        className="absolute right-1 top-1 size-6 bg-surface/90 hover:bg-surface"
        aria-label={t('remove')}
        title={t('remove')}
        onClick={onRemove}
      >
        <X size={14} aria-hidden="true" />
      </Button>
    </div>
  )
}

/**
 * Props for the {@link DefensePhotoStrip}.
 */
type DefensePhotoStripProps = {
  /** The composer's photos and what can be done with them. */
  photos: UseDefensePhotosResult
  /** The photo looked at in the review, or null where none is marked. */
  selectedId: number | null
  /** Looks at a photo in the review, given its id. */
  onOpen: (id: number) => void
  /** Classes for where the photos stand. */
  className?: string
  /** Tiles after the photos. */
  children?: ReactNode
}

/**
 * The photos of handwritten work the composer holds, in page order, the one looked at marked, and a line saying in
 * words how many are still being read.
 */
export function DefensePhotoStrip({
  photos,
  selectedId,
  onOpen,
  className,
  children,
}: DefensePhotoStripProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // How many photos have yet to be read
  const readingCount = photos.photos.filter((photo) => photo.kind === 'reading').length

  // Whether the strip is on screen yet. A status line is heard only once it changes, so it starts out empty even in
  // a review that opens on photos already being read
  const isMounted = useMounted()

  // The status line, there from the start so a reader hears it change, then the photos
  return (
    <>
      {/* Reading status, for readers the spinners say nothing to */}
      <p role="status" className="sr-only">
        {isMounted && readingCount > 0 ? t('reading', { count: readingCount }) : ''}
      </p>

      {/* Photos, then the tiles after them, in one row a phone scrolls sideways so a long batch leaves the room to
          the text. The padding is the marked tile's ring */}
      {(photos.photos.length > 0 || children !== undefined) && (
        <div
          className={cn(
            '-m-0.5 flex gap-2 overflow-x-auto p-0.5 sm:flex-wrap sm:overflow-visible',
            className
          )}
        >
          {photos.photos.map((photo, index) => (
            <DefensePhotoTile
              key={photo.id}
              photo={photo}
              number={index + 1}
              isSelected={photo.id === selectedId}
              onOpen={() => onOpen(photo.id)}
              onRetry={() => photos.retryPhoto(photo.id)}
              onRemove={() => photos.removePhotos([photo.id])}
            />
          ))}
          {children}
        </div>
      )}
    </>
  )
}
