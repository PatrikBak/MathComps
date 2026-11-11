'use client'

import { useMounted } from '@mantine/hooks'
import { Loader2, TriangleAlert, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { PhotoTile } from '@/components/shared/components/PhotoTile'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import type { DefensePhoto } from '../model/photo-reading'

/**
 * The edge of a photo's tile, by where its reading stands: only a failed one is marked.
 */
const TILE_BORDER: Record<DefensePhoto['kind'], string> = {
  reading: '',
  read: '',
  inserted: '',
  failed: 'border-error/40',
}

/**
 * A tile a press looks at in the review.
 */
type DefensePhotoTileOpen = {
  /** The discriminant, which is what a press does to it. */
  press: 'open'
  /** Never the photo looked at, which a press shows large instead. */
  isSelected: false
}

/**
 * A tile a press shows large.
 */
type DefensePhotoTileEnlarge = {
  /** The discriminant, which is what a press does to it. */
  press: 'enlarge'
  /** Whether it is the photo looked at in the review, which its edge marks. */
  isSelected: boolean
}

/**
 * What a photo's tile does.
 */
type DefensePhotoTileActions = (DefensePhotoTileOpen | DefensePhotoTileEnlarge) & {
  /** Acts on it as a press does. */
  onPress: () => void
  /** Drops it from the composer, or null where it stays. */
  onRemove: (() => void) | null
}

/**
 * Props for the {@link DefensePhotoTile}.
 */
type DefensePhotoTileProps = {
  /** The photo. */
  photo: DefensePhoto
  /** Where it stands among the photos shown with it, from 1. */
  number: number
  /** What a press and the tile's corner do. */
  actions: DefensePhotoTileActions
}

/**
 * One photo of handwritten work, previewing from the student's device or its stored page, with what its reading
 * came to. A failed one carries only a mark, never why it failed.
 */
function DefensePhotoTile({ photo, number, actions }: DefensePhotoTileProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

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

      // Read, so the photo shows as it is
      case 'read':
      case 'inserted':
        return null

      // The reading failed, which the photo is marked with
      case 'failed':
        return (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface/60">
            <TriangleAlert className="size-5 text-error" aria-hidden="true" />
          </div>
        )

      // Every state is handled above
      default:
        return assertNever(photo)
    }
  })()

  // What a press on the photo does, in words
  const pressLabel = t(actions.press, { number })

  // The photo, named by its place, which is also what says which photo its buttons act on
  return (
    <div role="group" aria-label={t('photo', { number })} className="relative shrink-0">
      {/* The photo under what its reading came to, clipped to the tile apart from the removal, whose focus
          ring reaches past it */}
      <PhotoTile
        src={photo.previewUrl}
        label={pressLabel}
        isCurrent={actions.isSelected}
        onPress={actions.onPress}
        className={TILE_BORDER[photo.kind]}
      >
        {overlay}
      </PhotoTile>

      {/* Removal, where the photo can be removed */}
      {actions.onRemove !== null && (
        <Button
          variant="ghost"
          size="icon"
          shape="pill"
          className="absolute right-1 top-1 size-6 bg-surface/90 hover:bg-surface"
          aria-label={t('remove')}
          title={t('remove')}
          onClick={actions.onRemove}
        >
          <X size={14} aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

/**
 * The photo looked at in the review, marked among the others.
 */
type DefensePhotoStripSelection = {
  /** The photo's id. */
  id: number
  /** Shows the photo large. */
  onEnlarge: () => void
}

/**
 * What the strip's photos do in the composer, where a press looks at one in the review and each can be removed.
 */
type DefensePhotoStripReview = {
  /** The discriminant. */
  kind: 'review'
  /** The photo looked at in the review, or null where none is marked. */
  selected: DefensePhotoStripSelection | null
  /** Looks at a photo in the review, given its id. */
  onOpen: (id: number) => void
  /** Drops photos from the composer, given their ids. */
  onRemove: (ids: readonly number[]) => void
}

/**
 * What the strip's photos do where they are only looked at, each shown large on a press.
 */
type DefensePhotoStripEnlarge = {
  /** The discriminant. */
  kind: 'enlarge'
  /** Shows a photo large, given its id. */
  onEnlarge: (id: number) => void
}

/**
 * What the strip's photos do.
 */
type DefensePhotoStripActions = DefensePhotoStripReview | DefensePhotoStripEnlarge

/**
 * Props for the {@link DefensePhotoStrip}.
 */
type DefensePhotoStripProps = {
  /** The photos shown, in page order. */
  photos: readonly DefensePhoto[]
  /** What a press on a photo and its corner do. */
  actions: DefensePhotoStripActions
  /** Classes for where the photos stand. */
  className?: string
  /** Tiles after the photos. */
  children?: ReactNode
}

/**
 * Photos of handwritten work in page order, the one looked at in a review marked, and a line saying in words how
 * many are still being read.
 */
export function DefensePhotoStrip({
  photos,
  actions,
  className,
  children,
}: DefensePhotoStripProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // How many photos have yet to be read
  const readingCount = photos.filter((photo) => photo.kind === 'reading').length

  // Whether the strip is on screen yet. A status line is heard only once it changes, so it starts out empty even in
  // a review that opens on photos already being read
  const isMounted = useMounted()

  /**
   * A function which says what a photo's tile does.
   *
   * @param id - The photo.
   * @returns What its tile does.
   */
  const tileActions = (id: number): DefensePhotoTileActions => {
    switch (actions.kind) {
      // In the composer, where a photo is dropped from its corner
      case 'review': {
        // The photo looked at in the review, and the ways a photo is looked at and dropped
        const { selected, onOpen, onRemove } = actions

        // A function which drops the photo
        const remove = () => onRemove([id])

        // The photo looked at, which a press enlarges
        if (selected !== null && selected.id === id) {
          return {
            isSelected: true,
            press: 'enlarge',
            onPress: selected.onEnlarge,
            onRemove: remove,
          }
        }

        // Any other, which a press looks at
        return { isSelected: false, press: 'open', onPress: () => onOpen(id), onRemove: remove }
      }

      // Only looked at, shown large on a press and kept
      case 'enlarge': {
        // The way a photo is shown large
        const { onEnlarge } = actions

        // Enlarged on a press
        return { isSelected: false, press: 'enlarge', onPress: () => onEnlarge(id), onRemove: null }
      }

      // Every kind is handled above
      default:
        return assertNever(actions)
    }
  }

  // The status line, there from the start so a reader hears it change, then the photos
  return (
    <>
      {/* Reading status, for readers the spinners say nothing to */}
      <p role="status" className="sr-only">
        {isMounted && readingCount > 0 ? t('reading', { count: readingCount }) : ''}
      </p>

      {/* Photos, then the tiles after them, in one row a phone scrolls sideways so a long batch stays one row
          tall. The padding is the marked tile's ring */}
      {(photos.length > 0 || children !== undefined) && (
        <div
          className={cn(
            '-m-0.5 flex gap-2 overflow-x-auto p-0.5 sm:flex-wrap sm:overflow-visible',
            className
          )}
        >
          {photos.map((photo, index) => (
            <DefensePhotoTile
              key={photo.id}
              photo={photo}
              number={index + 1}
              actions={tileActions(photo.id)}
            />
          ))}
          {children}
        </div>
      )}
    </>
  )
}
