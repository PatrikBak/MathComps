'use client'

import { ChevronLeft, ChevronRight, Mail, MailOpen, MailPlus, X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { HandoutProblemRefLabel } from '@/components/features/handouts/HandoutProblemRefLabel'
import { useHandoutProblemLabel } from '@/components/features/handouts/use-handout-problem-label'
import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { useKeyedState } from '@/hooks/use-keyed-state'

import { useDefenseReviewDetail } from '../hooks/use-defense-review-detail'
import { useDefenseReviewPanels } from '../hooks/use-defense-review-panels'
import { useDefenseReviewReadMarking } from '../hooks/use-defense-review-read-marking'
import type { UseDefenseReviewSelectionResult } from '../hooks/use-defense-review-selection'
import type { DefenseReviewDetail } from '../model/defense-review-types'
import { ActionLabel } from './ActionLabel'
import { DefenseReviewModalBody } from './DefenseReviewModalBody'

/**
 * Props for the {@link DefenseReviewModal} component.
 */
type DefenseReviewModalProps = {
  /** Which conversation is being read, and every way of moving off it. */
  selection: UseDefenseReviewSelectionResult
  /** The note the reader was sent to; null when they came in for the conversation itself. */
  landingNoteId: string | null
  /** Stamps a conversation as read. */
  onMarkRead: (sessionId: string) => void
  /** Leaves a conversation unread. */
  onMarkUnread: (sessionId: string) => void
  /** Runs once the dialog has finished leaving. */
  onClosed: () => void
}

/**
 * One conversation, read back in full.
 *
 * The dialog itself never unmounts while the reader works through the queue: stepping from one conversation to
 * the next swaps what is inside it, so the focus trap never re-runs and the arrow that was just pressed stays
 * under the reader's finger. The header holds its height across that swap by keeping a blank line where the
 * problem goes, since what the conversation was about is one of the things still being read.
 *
 * The read toggle carries words beside its envelope wherever the header has room for them: an envelope on its
 * own says nothing about which way it is about to go.
 *
 * It opens with focus on the panel and on no control at all. The transcript would be the place to land, since
 * paging through it is what the reader came to do, but its scroll region takes no focus of its own, and left to
 * itself the dialog lands on the first control in the header, which writes a read state to the server the moment
 * a reader pages with the space bar.
 */
export function DefenseReviewModal({
  selection,
  landingNoteId,
  onMarkRead,
  onMarkUnread,
  onClosed,
}: DefenseReviewModalProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // The conversation itself
  const { detail, uiState } = useDefenseReviewDetail(selection.openId)

  // How much of it stands on screen at once, and which part the reader is looking at
  const panels = useDefenseReviewPanels(landingNoteId)

  // Reading it, and where the last pass through it stopped
  const readMarking = useDefenseReviewReadMarking(
    detail,
    selection.openId,
    onMarkRead,
    onMarkUnread
  )

  // Which reply a new note will stand against, which the reply picked in the conversation just left says
  // nothing about. Held above the notes tab because the transcript marks the reply being written about, and on
  // a wide enough screen the two panels sit side by side.
  const [noteTurnId, setNoteTurnId] = useKeyedState<string | null>(selection.openId, null)

  return (
    <Modal
      isOpen={selection.openId !== null}
      onClose={selection.close}
      showCloseButton={false}
      padded={false}
      tall
      focusPanelOnOpen
      className="sm:max-w-6xl 2xl:max-w-[102rem]"
      ariaLabel={
        detail === null
          ? t('detailTitle')
          : t('detailTitleFor', { student: detail.user.displayName })
      }
      onClosed={() => {
        panels.reset()
        readMarking.reset()
        onClosed()
      }}
    >
      {/* The header: who held it, and the way through the queue */}
      <header className="flex shrink-0 items-center gap-3 border-b border-foreground/10 px-4 py-2.5 sm:px-5">
        {/* Who held it, and what it was about */}
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate font-bold text-foreground">{detail?.user.displayName ?? ' '}</p>
          <p className="flex items-baseline gap-2 truncate text-xs text-muted">
            {detail === null ? <span>&nbsp;</span> : <ConversationProblemRef detail={detail} />}
          </p>
        </div>

        {/* Whether it counts as read */}
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 px-2"
          onClick={readMarking.toggleRead}
        >
          {readMarking.isRead ? (
            <MailOpen size={16} aria-hidden="true" />
          ) : (
            <Mail size={16} aria-hidden="true" />
          )}
          <ActionLabel>{readMarking.isRead ? t('markUnread') : t('markRead')}</ActionLabel>
        </Button>

        {/* The way through the queue, in the order the list shows it */}
        <div className="flex shrink-0 items-center gap-1 text-xs text-muted">
          {/* Back one */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('previous')}
            aria-keyshortcuts="k"
            disabled={!selection.canStep(-1)}
            onClick={() => selection.step(-1)}
          >
            <ChevronLeft size={16} />
          </Button>

          {/* Where it sits in the queue */}
          {selection.position !== null && (
            <span className="tabular-nums">
              {t('position', {
                index: selection.position.index,
                total: selection.position.total,
              })}
            </span>
          )}

          {/* On one */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('next')}
            aria-keyshortcuts="j"
            disabled={!selection.canStep(1)}
            onClick={() => selection.step(1)}
          >
            <ChevronRight size={16} />
          </Button>

          {/* Past everything already read */}
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 gap-1.5 px-2"
            aria-keyshortcuts="u"
            disabled={!selection.canStepUnread}
            onClick={selection.stepUnread}
          >
            <MailPlus size={16} aria-hidden="true" />
            <ActionLabel>{t('nextUnread')}</ActionLabel>
          </Button>
        </div>

        {/* Out of the conversation */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={tActions('close')}
          onClick={selection.close}
        >
          <X size={16} />
        </Button>
      </header>

      {/* What it holds, once it has arrived */}
      {detail === null ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <FetchStatePlaceholder
            uiState={uiState}
            className="flex flex-col items-center gap-2 text-center"
            // A conversation that arrived empty reads the same way as one still on its way
            empty={<LoadingSpinner />}
            failed={<p className="text-sm text-muted">{t('detailFailed')}</p>}
          />
        </div>
      ) : (
        <DefenseReviewModalBody
          detail={detail}
          panels={panels}
          firstNewTurn={readMarking.firstNewTurn}
          noteTurnId={noteTurnId}
          landingNoteId={landingNoteId}
          onNoteTurnIdChange={setNoteTurnId}
        />
      )}
    </Modal>
  )
}

/**
 * Props for the {@link ConversationProblemRef} component.
 */
type ConversationProblemRefProps = {
  /** The conversation whose problem is being named. */
  detail: DefenseReviewDetail
}

/**
 * Which problem of which handout the open conversation was held against.
 *
 * A component of its own so that naming the problem, which reads handout content, happens only once there is a
 * conversation to name one for.
 */
function ConversationProblemRef({ detail }: ConversationProblemRefProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Which problem of which handout it was held against
  const problemLabel = useHandoutProblemLabel(detail.target, t('deletedHandout'))

  return <HandoutProblemRefLabel label={problemLabel} />
}
