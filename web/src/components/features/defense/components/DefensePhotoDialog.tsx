'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import type { ToolbarConfig } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'
import { assertNever } from '@/components/shared/utils/assert-never'
import { focusIfDropped } from '@/components/shared/utils/focus-utils'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { getPathname } from '@/i18n/navigation'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import type { UseComposerPhotosResult } from '../hooks/use-composer-photos'
import type { UseDefensePhotoReviewResult } from '../hooks/use-defense-photo-review'
import type { DefensePhotoHandoff } from '../model/photo-handoff-code'
import { DefensePhotoSideBySide } from './DefensePhotoSideBySide'
import { DefensePhotoTrouble } from './DefensePhotoTrouble'

/**
 * A spinner in the QR's place, while the code or the QR library is still loading.
 */
function DefensePhoneQrWaiting() {
  // The spinner, in the middle of the QR's place
  return (
    <div className="flex size-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted" aria-hidden="true" />
    </div>
  )
}

/**
 * Props for the {@link DefensePhoneTrouble}.
 */
type DefensePhoneTroubleProps = {
  /** Why there is no QR, in words. */
  why: string
  /** Tries again for the QR. */
  onRetry: () => void
}

/**
 * What stands in the QR's place when something kept the QR away: a warning, why, and a button to try again.
 */
function DefensePhoneTrouble({ why, onRetry }: DefensePhoneTroubleProps) {
  // Copy for the buttons the whole app shares
  const tActions = useTranslations('ui.actions')

  // The warning, why, and the button
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 text-center text-sm">
      <DefensePhotoTrouble heading={null} why={why}>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          {tActions('retry')}
        </Button>
      </DefensePhotoTrouble>
    </div>
  )
}

/**
 * What the handoff shows in one of its states: what stands in the QR's place, and what to do, in words.
 */
type DefensePhoneHandoffView = {
  /** What stands in the QR's place. */
  place: ReactNode
  /** What to do, in words, or empty while what stands in the QR's place says it. */
  status: string
}

/**
 * Props for the {@link DefensePhoneHandoff}.
 */
type DefensePhoneHandoffProps = {
  /** The state of the code the student's phone sends photos with. */
  handoff: DefensePhotoHandoff
  /** Asks for the code again, after it never came. */
  onRetry: () => void
}

/**
 * The student's code as a QR their phone's camera opens the phone page from, once it comes.
 */
function DefensePhoneHandoff({ handoff, onRetry }: DefensePhoneHandoffProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // The student's language, which the phone page opens in too
  const locale = useLocale() as Locale

  // The QR library, loaded only once the dialog asks for it, since most students never ask for their phone
  const qrLibrary = useQuery({
    // The same library for every student and language
    queryKey: ['qrcode.react'],

    // The library's code, fetched while the student's code is on its way
    queryFn: () => import('qrcode.react'),

    // Code that never changes while the page lives
    staleTime: Infinity,

    // A failed load shown at once, with another try that fetches it again
    retry: false,
  })

  // What the handoff shows, by where the code stands
  const view = ((): DefensePhoneHandoffView => {
    switch (handoff.kind) {
      // On its way
      case 'pointing':
        return { place: <DefensePhoneQrWaiting />, status: t('phoneMaking') }

      // Never came, which says why in the QR's place, with another try
      case 'failed': {
        // Why, in words, or the generic failure where nothing said why
        const why = resolveErrorMessage(handoff.errorCode, tApiErrors, {
          fallback: t('phoneError'),
        })

        // The failure in the QR's place, with another try
        return {
          place: <DefensePhoneTrouble why={why} onRetry={onRetry} />,
          status: '',
        }
      }

      // The code in, shown as a QR once the QR library has loaded too
      case 'pointed':
        switch (qrLibrary.status) {
          // The library still loading
          case 'pending':
            return { place: <DefensePhoneQrWaiting />, status: t('phoneMaking') }

          // The library that failed to load, with another try, which waits as it fetches the library again
          case 'error':
            return qrLibrary.isFetching
              ? { place: <DefensePhoneQrWaiting />, status: t('phoneMaking') }
              : {
                  place: (
                    <DefensePhoneTrouble
                      why={t('phoneQrError')}
                      onRetry={() => void qrLibrary.refetch()}
                    />
                  ),
                  status: '',
                }

          // The QR of the phone page opened on the code, dark on white whatever the site's theme, as a camera reads it
          case 'success': {
            // The phone page's path, in the student's language
            const pathname = getPathname({ href: ROUTES.PHOTO_HANDOFF, locale })

            // The phone page's address on this site, the code after the # so no server ever logs it
            const link = `${window.location.origin}${pathname}#${handoff.code}`

            // The QR component of the loaded library
            const { QRCodeSVG } = qrLibrary.data

            // The QR, its quiet margin inside the white, and how to use it
            return {
              place: (
                <QRCodeSVG
                  value={link}
                  marginSize={4}
                  title={t('phoneQr')}
                  className="size-full rounded-lg"
                />
              ),
              status: t('phoneScan'),
            }
          }

          // Every state of the library's load is handled above
          default:
            return assertNever(qrLibrary)
        }

      // Every state is handled above
      default:
        return assertNever(handoff)
    }
  })()

  // The QR's place, then what to do
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      {/* The QR's place, one size whatever stands in it, fresh with each state of the code. It takes the focus when
          the control holding it went away: the review's menu, or the retry of the code */}
      <div
        key={handoff.kind}
        ref={focusIfDropped}
        tabIndex={-1}
        className="size-48 focus:outline-none"
      >
        {view.place}
      </div>

      {/* What to do, heard as it changes */}
      <p role="status" className="text-center text-sm text-muted">
        {view.status}
      </p>
    </div>
  )
}

/**
 * The dialog's shell around one of the things it shows, and that thing.
 */
type DefensePhotoDialogShell = {
  /** The dialog's title. */
  title: string
  /** Whether the dialog fills the screen's height. */
  tall: boolean
  /** Classes for the dialog's panel. */
  className: string | undefined
  /** What stands in the dialog. */
  body: ReactNode
}

/**
 * Props for the {@link DefensePhotoDialog}.
 */
type DefensePhotoDialogProps = {
  /** What the dialog shows, and the ways into and out of it. */
  review: UseDefensePhotoReviewResult
  /** The composer's photos and what can be done with them. */
  photos: UseComposerPhotosResult
  /** The turn being written. */
  draft: string
  /** Takes the turn with the pages' text put into it. */
  onDraftChange: (draft: string) => void
  /** The longest a single student message may be, or null while the caps are not known. */
  maxCharacters: number | null
  /** The tools the turn is written with. */
  toolbar: ToolbarConfig
  /** Called once the dialog has finished closing. */
  onClosed: () => void
}

/**
 * The one dialog over the composer's photos, showing the pages beside their text or the handoff to the student's
 * phone. It stays one dialog as it goes from one to the other, so the page behind it never shows through between them.
 */
export function DefensePhotoDialog({
  review,
  photos,
  draft,
  onDraftChange,
  maxCharacters,
  toolbar,
  onClosed,
}: DefensePhotoDialogProps) {
  // Copy for the composer's photos
  const t = useTranslations('defense.photos')

  // What the dialog shows
  const { dialog } = review

  // The dialog's shell and what stands in it, by what it shows
  const shown = ((): DefensePhotoDialogShell | null => {
    switch (dialog.kind) {
      // Nothing, the dialog shut
      case 'shut':
        return null

      // The code for the phone, at the dialog's own width
      case 'phone':
        return {
          title: t('phoneTitle'),
          tall: false,
          className: undefined,
          body: <DefensePhoneHandoff handoff={review.handoff} onRetry={review.openPhone} />,
        }

      // The pages beside their text, across the whole screen's height
      case 'review': {
        // The photo looked at, always among the photos, since the review moves off a photo as it is dropped
        const viewed = photos.photos.find((photo) => photo.id === dialog.photoId)

        // Nothing to show without it
        if (viewed === undefined) return null

        // The review, on the photo looked at
        return {
          title: t('reviewTitle'),
          tall: true,
          className: 'sm:max-w-6xl',
          body: (
            <DefensePhotoSideBySide
              viewed={viewed}
              onView={review.view}
              onPick={review.pick}
              onPhone={review.openPhone}
              onClose={review.close}
              photos={photos}
              draft={draft}
              onDraftChange={onDraftChange}
              maxCharacters={maxCharacters}
              toolbar={toolbar}
            />
          ),
        }
      }

      // Every state is handled above
      default:
        return assertNever(dialog)
    }
  })()

  // The one dialog, whichever it shows
  return (
    <Modal
      isOpen={shown !== null}
      onClose={review.close}
      onClosed={onClosed}
      title={shown?.title}
      showCloseButton
      tall={shown?.tall}
      className={shown?.className}
    >
      {shown?.body}
    </Modal>
  )
}
