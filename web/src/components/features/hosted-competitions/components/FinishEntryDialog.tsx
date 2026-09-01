'use client'

import { useTranslations } from 'next-intl'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'

import type { HostedCompetitionsReaderKey } from '../hooks/hosted-competition-cache'
import { useFinishHostedCompetition } from '../hooks/use-finish-hosted-competition'

/**
 * Props for the {@link FinishEntryDialog} component.
 */
type FinishEntryDialogProps = {
  /** Who the cached answers belong to. */
  readerKey: HostedCompetitionsReaderKey
  /** Which competition is being handed in. */
  competitionSlug: string
  /** Whether the student has been asked whether they really mean to hand the entry in. */
  isAsked: boolean
  /** Whether the counted part is already over. */
  hasEnded: boolean
  /** Drops the question, leaving the entry as it stands. */
  onClose: () => void
  /** Called once the entry is closed. */
  onFinished: () => void
}

/**
 * What handing in costs, asked before it happens, there being no way back from it.
 *
 * The clock can run out while the question is still on screen, and an entry the buzzer has already closed has
 * nothing left to hand in: the question goes with it, rather than leaving an irreversible press standing over
 * a page which has moved on without it. A press already in flight keeps it, so the buzzer landing in the
 * moment between pressing and the answer coming back does not take the spinner off the screen.
 */
export function FinishEntryDialog({
  readerKey,
  competitionSlug,
  isAsked,
  hasEnded,
  onClose,
  onFinished,
}: FinishEntryDialogProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Closing the entry where the student says rather than where the clock does
  const { finish, isFinishing } = useFinishHostedCompetition(readerKey, competitionSlug, onFinished)

  // Nothing left to ask about, unless the answer to the asking is still coming back
  if (!isAsked || (hasEnded && !isFinishing)) {
    return null
  }

  // The question itself
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={t('finishDialog.title')}
      showCloseButton={false}
      className="max-w-md hyphens-none"
      // Nothing is focused ahead of the reader on a dialog whose primary button cannot be undone
      focusPanelOnOpen
    >
      <p className="text-sm leading-relaxed text-foreground/80">{t('finishDialog.consequence')}</p>

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose}>
          {t('finishDialog.keepWorking')}
        </Button>
        <Button variant="danger" loading={isFinishing} onClick={finish}>
          {t('finishDialog.confirm')}
        </Button>
      </div>
    </Modal>
  )
}
