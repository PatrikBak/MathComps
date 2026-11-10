'use client'

import type { ReactNode } from 'react'

import { ImageWithLoader } from '@/components/shared/components/ImageWithLoader'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link PhotoTile}.
 */
type PhotoTileProps = {
  /** Where the photo loads from. */
  src: string
  /** What a press on the tile does, in words, which is the tile's whole accessible name. */
  label: string
  /** Whether it is the photo looked at among the tiles beside it, which its edge marks. */
  isCurrent?: boolean
  /** Whether the photo shows whole at a square tile's height, its width following, rather than a square of it. */
  isWhole?: boolean
  /** What a press does. */
  onPress: () => void
  /** Classes of its own, laid over the frame every tile shares, such as the colour of its edge. */
  className?: string
  /** What lies over the photo. */
  children?: ReactNode
}

/**
 * A small photo in a rounded frame, acting on the photo when pressed: a square cropped out of it, or the whole of
 * it at the same height.
 */
export function PhotoTile({
  src,
  label,
  isCurrent = false,
  isWhole = false,
  onPress,
  className,
  children,
}: PhotoTileProps) {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg border border-foreground/10 bg-surface',
        // A whole photo keeps the tile's height before it loads, and one too wide for the row is scaled down to it
        isWhole ? 'h-20 max-w-full' : 'size-20',
        className,
        // The photo looked at, marked over whatever edge it was given
        isCurrent && 'border-brand ring-2 ring-brand/40'
      )}
    >
      <button
        type="button"
        // The photo covers the button and the frame clips round it, so the ring is an outline drawn inside the frame,
        // over the photo
        className={cn(
          'block cursor-pointer rounded-[inherit]',
          'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
          isWhole ? 'flex h-full items-center' : 'size-full'
        )}
        aria-label={label}
        aria-current={isCurrent || undefined}
        title={label}
        onClick={onPress}
      >
        {/* The photo, whole or a square of it */}
        {isWhole ? (
          // The whole photo, as tall as a square tile inside its edge, or centred in it where it comes out shorter
          <ImageWithLoader
            src={src}
            alt=""
            width={0}
            height={0}
            className="max-h-19.5"
            containerClassName="rounded-none"
          />
        ) : (
          // A square of the photo, filling the frame
          <ImageWithLoader src={src} alt="" fill className="object-cover" fallback={null} />
        )}
      </button>
      {children}
    </div>
  )
}
