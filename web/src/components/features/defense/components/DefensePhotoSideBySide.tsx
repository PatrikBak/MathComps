'use client'

import { useElementSize } from '@mantine/hooks'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import type { ToolbarConfig } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { RichMathEditor } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import type { ComposerPhoto, UseDefensePhotosResult } from '../hooks/use-defense-photos'
import { DefensePhotoButton } from './DefensePhotoButton'
import { DefensePhotoStrip } from './DefensePhotoStrip'

/**
 * Props for the {@link DefenseSidePhoto}.
 */
type DefenseSidePhotoProps = {
  /** The photo. */
  photo: ComposerPhoto
  /** Where it stands among the composer's photos, from 1. */
  number: number
  /** The composer's photos and what can be done with them. */
  photos: UseDefensePhotosResult
}

/**
 * One photo beside its text, with what its reading came to over it.
 */
function DefenseSidePhoto({ photo, number, photos }: DefenseSidePhotoProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // What lies over the photo, by where its reading stands
  const overlay = (() => {
    switch (photo.kind) {
      // Still being read, which its text beside it says, or read, its text there
      case 'reading':
      case 'read':
      case 'inserted':
        return null

      // The reading failed, so the photo offers another go
      case 'failed':
        return (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface/85 text-sm">
            <p className="text-error">{t('readError')}</p>
            <Button variant="secondary" size="sm" onClick={() => photos.retryPhoto(photo.id)}>
              {tActions('retry')}
            </Button>
          </div>
        )

      // Every state is handled above
      default:
        return assertNever(photo)
    }
  })()

  // The photo under what its reading came to
  return (
    <section
      aria-label={t('photo', { number })}
      className="relative overflow-hidden rounded-lg border border-foreground/10"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, nothing for a server to optimize */}
      <img src={photo.previewUrl} alt={t('photo', { number })} className="w-full" />
      {overlay}
    </section>
  )
}

/**
 * Props for the {@link DefensePageText}.
 */
type DefensePageTextProps = {
  /** The page whose text it is. */
  photo: ComposerPhoto
  /** The composer's photos and what can be done with them. */
  photos: UseDefensePhotosResult
  /** The longest a single student message may be, or null while the caps are not known. */
  maxCharacters: number | null
  /** The tools the text is written with. */
  toolbar: ToolbarConfig
  /** How tall the text stands, in px, or 0 before its column is measured. */
  heightPx: number
  /** Whether the text takes the cursor as it comes up. */
  autoFocus: boolean
}

/**
 * One page's text, by where its reading stands: shut while the page is read, there to check once it is, and a note
 * once it is in the message or the reading failed.
 */
function DefensePageText({
  photo,
  photos,
  maxCharacters,
  toolbar,
  heightPx,
  autoFocus,
}: DefensePageTextProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  /**
   * A function which draws the page's text in its editor, once its column is measured.
   *
   * @param text - The text.
   * @param isLocked - Whether the page is still being read, which shuts the editor.
   *
   * @returns The editor, or nothing before its column has a height to give it.
   */
  const editor = (text: string, isLocked: boolean) =>
    heightPx > 0 && (
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Text */}
        <div
          inert={isLocked}
          className={cn(
            'flex min-h-0 flex-1 flex-col transition-opacity',
            isLocked && 'opacity-40'
          )}
        >
          <RichMathEditor
            // A page of its own starts an editor of its own, and so does its text arriving, since an editor shut
            // while the page was read never took the cursor
            key={`${photo.id}-${isLocked}`}
            variant="card"
            toolbar={toolbar}
            maxCharacters={maxCharacters}
            value={text}
            onChange={(next) => photos.editText(photo.id, next)}
            autoFocus={autoFocus}
            heightPx={heightPx}
            placeholder={t('messagePlaceholder')}
          />
        </div>

        {/* Why it is shut */}
        {isLocked && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="flex items-center gap-2 rounded-full border border-foreground/10 bg-surface px-3 py-1.5 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t('readingPage')}
            </p>
          </div>
        )}
      </div>
    )

  /**
   * A function which says why the page has no text to edit here.
   *
   * @param why - What to say.
   *
   * @returns The note.
   */
  const note = (why: string) => (
    <p
      className={cn(
        'flex flex-1 items-center justify-center p-6 text-center text-sm text-muted',
        'rounded-lg border border-dashed border-foreground/10'
      )}
    >
      {why}
    </p>
  )

  // The text, or why there is none to edit here
  switch (photo.kind) {
    // Still being read, so the editor stays shut until the text arrives
    case 'reading':
      return editor('', true)

    // Read, its text there to check
    case 'read':
      return editor(photo.text, false)

    // In the message, where its text is edited now
    case 'inserted':
      return note(t('inserted'))

    // The reading failed, which the photo offers to try again
    case 'failed':
      return note(t('readError'))

    // Every state is handled above
    default:
      return assertNever(photo)
  }
}

/**
 * Props for the {@link DefensePhotoSideBySide}.
 */
type DefensePhotoSideBySideProps = {
  /** The photo looked at, or null while the view is shut. */
  viewedPhotoId: number | null
  /** Looks at a photo, given its id. */
  onView: (id: number) => void
  /** Takes newly picked pages, looking at the first of them. */
  onPick: (files: readonly File[]) => void
  /** Shuts the view. */
  onClose: () => void
  /** Called once the view is gone and the composer is the student's again. */
  onClosed: () => void
  /** The composer's photos and what can be done with them. */
  photos: UseDefensePhotosResult
  /** The turn being written. */
  draft: string
  /** Takes the turn with the pages' text put into it. */
  onDraftChange: (draft: string) => void
  /** The longest a single student message may be, or null while the caps are not known. */
  maxCharacters: number | null
  /** The tools the turn is written with. */
  toolbar: ToolbarConfig
}

/**
 * Each page beside its text, read from the photo, for the student to check before the pages' text goes into the
 * message together. A phone has no room for both, so there the pages show as their tiles alone above the text.
 * Pages are added here; the message is written on and sent from the composer.
 */
export function DefensePhotoSideBySide({
  viewedPhotoId,
  onView,
  onPick,
  onClose,
  onClosed,
  photos,
  draft,
  onDraftChange,
  maxCharacters,
  toolbar,
}: DefensePhotoSideBySideProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // The column the page's text stands in, and how tall it is
  const { ref: textColumnRef, height: textColumnHeight } = useElementSize()

  // Whether touch is the only way in, where the text taking the cursor as it comes up would bring up the keyboard
  // before the student asks for it
  const { isTouchOnly } = useDeviceCapabilities()

  // The photo looked at, none while the view is shut
  const viewed = photos.photos.find((photo) => photo.id === viewedPhotoId)

  // Puts the read pages' text into the message and goes back to the composer
  const insert = () => {
    // The pages' text, in page order, each page now in the message
    const texts = photos.insertRead()

    // The texts after what the message already says, a blank line between each, a page left empty skipped
    onDraftChange(
      [draft, ...texts]
        .map((part) => part.trim())
        .filter((part) => part !== '')
        .join('\n\n')
    )

    // Back to the composer
    onClose()
  }

  // How many pages are read and waiting to go into the message
  const readCount = photos.photos.filter((photo) => photo.kind === 'read').length

  // Whether a page has no text yet, still being read or failed, which holds every page back until it is read or
  // removed, so the pages go into the message in their order
  const hasUnreadPage = photos.photos.some(
    (photo) => photo.kind === 'reading' || photo.kind === 'failed'
  )

  // The pages on one side, the text of the one looked at on the other
  return (
    <Modal
      isOpen={viewed !== undefined}
      onClose={onClose}
      onClosed={onClosed}
      title={t('reviewTitle')}
      showCloseButton
      tall
      className="sm:max-w-6xl"
    >
      {/* Everything above the insert, scrolling on a phone only once the tiles leave the text too little room */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col',
          '-mx-3 -mt-1 overflow-y-auto px-3 sm:mx-0 sm:-mt-3 sm:overflow-visible sm:px-0'
        )}
      >
        <p className="mb-3 text-sm text-muted">{t('reviewHint')}</p>

        <div className="flex min-h-0 flex-1 flex-col gap-4 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
          {/* Photos */}
          <div className="flex flex-col gap-3 sm:min-h-0">
            {/* Every page, the one looked at marked, then more */}
            <DefensePhotoStrip photos={photos} selectedId={viewed?.id ?? null} onOpen={onView}>
              <DefensePhotoButton variant="page" onPick={onPick} />
            </DefensePhotoStrip>

            {/* The page looked at, where there is room for it beside its text */}
            <div className="hidden sm:block sm:min-h-0 sm:flex-1 sm:overflow-y-auto">
              {viewed !== undefined && (
                <DefenseSidePhoto
                  photo={viewed}
                  number={photos.photos.indexOf(viewed) + 1}
                  photos={photos}
                />
              )}
            </div>
          </div>

          {/* Its text, standing as tall as its column once that is measured */}
          <div ref={textColumnRef} className="flex min-h-64 flex-1 flex-col sm:min-h-0">
            {viewed !== undefined && (
              <DefensePageText
                photo={viewed}
                photos={photos}
                maxCharacters={maxCharacters}
                toolbar={toolbar}
                heightPx={Math.floor(textColumnHeight)}
                autoFocus={!isTouchOnly}
              />
            )}
          </div>
        </div>
      </div>

      {/* Into the message, which is where it is sent from */}
      <div className="mt-3 flex justify-end border-t border-foreground/10 pt-3">
        <Button
          variant="primary"
          size="sm"
          className="w-full sm:w-auto"
          disabled={readCount === 0 || hasUnreadPage}
          onClick={insert}
        >
          {t('insert', { count: readCount })}
        </Button>
      </div>
    </Modal>
  )
}
