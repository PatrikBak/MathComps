'use client'

import { useTranslations } from 'next-intl'

import { PhotoTile } from '@/components/shared/components/PhotoTile'
import { PhotoViewer } from '@/components/shared/components/PhotoViewer'

import { useDefensePhotoViewer } from '../hooks/use-defense-photo-viewer'
import type { DefenseTurnPhoto } from '../model/defense-types'

/**
 * Props for the {@link DefenseTurnPhotos}.
 */
type DefenseTurnPhotosProps = {
  /** The photos the message was sent with, in page order. */
  photos: readonly DefenseTurnPhoto[]
  /** Whether the drawings cut out of the photos for Mathilda show under the photos. */
  showsDrawings: boolean
}

/**
 * The photos of handwritten pages a message was sent with, as small tiles, each opening the pages over the whole
 * screen. Under them, where the reader is shown them, come the drawings Mathilda was handed in their place, whole at
 * the tiles' height and numbered across the message in page order, the way she numbers them.
 */
export function DefenseTurnPhotos({ photos, showsDrawings }: DefenseTurnPhotosProps) {
  // Copy for the photos of handwritten work
  const t = useTranslations('defense.photos')

  // The pages shown large, and the ways in and out
  const pagesViewer = useDefensePhotoViewer({
    links: photos.map((photo) => photo.link),
    item: 'photo',
  })

  // Every drawing cut out of the pages, in page order, none where the reader isn't shown them
  const drawings = showsDrawings ? photos.flatMap((photo) => photo.crops) : []

  // The drawings shown large, and the ways in and out
  const drawingsViewer = useDefensePhotoViewer({
    links: drawings.map((drawing) => drawing.link),
    item: 'drawing',
  })

  return (
    <div className="space-y-2 pt-1.5">
      {/* Pages */}
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, position) => (
          <PhotoTile
            key={photo.id}
            src={photo.link}
            label={t('enlarge', { number: position + 1 })}
            onPress={() => pagesViewer.openAt(position)}
          />
        ))}
      </div>

      {/* Drawings */}
      {drawings.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted">{t('drawingsCutOut')}</p>
          <div className="flex flex-wrap gap-2">
            {drawings.map((drawing, position) => (
              <PhotoTile
                key={drawing.id}
                src={drawing.link}
                label={t('enlargeDrawing', { number: position + 1 })}
                isWhole
                onPress={() => drawingsViewer.openAt(position)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pages over the whole screen */}
      <PhotoViewer
        photos={pagesViewer.viewerPhotos}
        index={pagesViewer.index}
        isOpen={pagesViewer.isOpen}
        onIndexChange={pagesViewer.swipeTo}
        onClose={pagesViewer.close}
      />

      {/* Drawings over the whole screen */}
      <PhotoViewer
        photos={drawingsViewer.viewerPhotos}
        index={drawingsViewer.index}
        isOpen={drawingsViewer.isOpen}
        onIndexChange={drawingsViewer.swipeTo}
        onClose={drawingsViewer.close}
      />
    </div>
  )
}
