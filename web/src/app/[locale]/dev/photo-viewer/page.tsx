'use client'

import { useDisclosure } from '@mantine/hooks'
import { useId, useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { PhotoTile } from '@/components/shared/components/PhotoTile'
import { PhotoViewer } from '@/components/shared/components/PhotoViewer'
import { useNow } from '@/hooks/use-now'

import { HARNESS_COPY, HARNESS_PHOTOS } from './photo-viewer-harness'

/**
 * A row of photo tiles, each opening the viewer on its own photo, and the viewer they open. The tile of the photo the
 * viewer last showed is marked, following every move the viewer reports.
 */
function PhotoRow() {
  // Whether the viewer is open
  const [isOpen, { open, close }] = useDisclosure(false)

  // Where the photo shown stands among the photos, kept past a close so the viewer doesn't jump while it fades out
  const [index, setIndex] = useState(0)

  // A function which opens the viewer on the photo pressed
  const openAt = (pressed: number) => {
    // The photo pressed is the one shown
    setIndex(pressed)

    // The viewer over the whole screen
    open()
  }

  // The tiles, the photo last looked at marked among them, and the viewer they open
  return (
    <>
      {/* Tiles */}
      <div className="flex gap-2">
        {HARNESS_PHOTOS.map((photo, position) => (
          <PhotoTile
            key={photo.src}
            src={photo.src}
            label={HARNESS_COPY.openPhoto(position + 1)}
            isCurrent={position === index}
            onPress={() => openAt(position)}
          />
        ))}
      </div>

      {/* Viewer */}
      <PhotoViewer
        photos={HARNESS_PHOTOS}
        index={index}
        isOpen={isOpen}
        onIndexChange={setIndex}
        onClose={close}
      />
    </>
  )
}

/**
 * Dev-only harness for the {@link PhotoViewer} on its own: opened straight from the page, and opened from inside a
 * dialog, where it has to leave the dialog standing. The page redraws every second, as a page with a running clock
 * does, and every redraw hands each viewer its photos again.
 */
export default function PhotoViewerPage() {
  // The page redrawn on every tick of a clock
  useNow()

  // Whether the dialog is open
  const [isDialogOpen, { open: openDialog, close: closeDialog }] = useDisclosure(false)

  // The heading naming the photos opened straight from the page
  const pageHeadingId = useId()

  // The photos straight on the page, then the dialog holding photos of its own
  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {/* Photos on the page */}
      <section aria-labelledby={pageHeadingId} className="space-y-3">
        <h1 id={pageHeadingId} className="text-xl font-semibold">
          {HARNESS_COPY.pageSection}
        </h1>
        <PhotoRow />
      </section>

      {/* Photos in a dialog */}
      <div>
        <Button variant="secondary" onClick={openDialog}>
          {HARNESS_COPY.openDialog}
        </Button>
        <Modal
          isOpen={isDialogOpen}
          onClose={closeDialog}
          title={HARNESS_COPY.dialogTitle}
          showCloseButton
        >
          <PhotoRow />
        </Modal>
      </div>
    </div>
  )
}
