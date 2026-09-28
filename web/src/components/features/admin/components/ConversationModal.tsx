'use client'

import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { Button } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import { STEP_KEYS } from '@/hooks/use-step-hotkeys'
import type { UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'
import type { QueryUiState } from '@/lib/query-ui-state'

/**
 * Props for the {@link ConversationModal} component.
 */
type ConversationModalProps = {
  /** Which item of the list is open, and every way of moving off it. */
  selection: UseSteppedSelectionResult
  /** What the dialog is called for assistive technology. */
  ariaLabel: string
  /** Who the open item is about; null while that is unknown. */
  title: string | null
  /** What the open item is about; null while that is unknown. */
  subtitle: ReactNode | null
  /** Controls acting on the open item, standing before the way through the list. */
  actions?: ReactNode
  /** Further ways through the list, standing after the step forward. */
  stepActions?: ReactNode
  /** What the open item holds; null until it has arrived with something to show. */
  body: ReactNode | null
  /** How far the read of the body got. */
  uiState: QueryUiState
  /** What stands in the body's place when it could not be read. */
  failedMessage: string
  /** Runs once the dialog has finished leaving. */
  onClosed?: () => void
}

/**
 * A dialog for working through a list one item at a time: a header naming the open item and
 * holding the way through the list, over the item itself.
 *
 * The dialog itself never unmounts while the reader works through the list: stepping from one item to the next
 * swaps what is inside it, so the focus trap never re-runs and the arrow that was just pressed stays under the
 * reader's finger. The header holds its height across that swap by keeping a blank line where each name goes.
 *
 * It opens with focus on the panel and on no control at all. The transcript would be the place to land, since
 * paging through it is what the reader came to do, but its scroll region takes no focus of its own, and left to
 * itself the dialog lands on the first control in the header, which a reader paging with the space bar would
 * then press.
 */
export function ConversationModal({
  selection,
  ariaLabel,
  title,
  subtitle,
  actions,
  stepActions,
  body,
  uiState,
  failedMessage,
  onClosed,
}: ConversationModalProps) {
  // Shared conversation-dialog copy
  const t = useTranslations('admin.conversation')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  return (
    <Modal
      isOpen={selection.openId !== null}
      onClose={selection.close}
      showCloseButton={false}
      padded={false}
      tall
      focusPanelOnOpen
      className="sm:max-w-6xl 2xl:max-w-[102rem]"
      ariaLabel={ariaLabel}
      onClosed={onClosed}
    >
      {/* The header: who and what, and the way through the list */}
      <header
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-foreground/10',
          'px-4 py-2.5 sm:flex-nowrap sm:px-5'
        )}
      >
        {/* Who and what, opted out of the hyphenation the page turns on globally */}
        <div className="w-full min-w-0 hyphens-none sm:w-auto sm:flex-1" aria-live="polite">
          <p className="truncate font-bold text-foreground">{title ?? '\u00A0'}</p>
          <p className="flex items-baseline gap-2 text-xs text-muted">
            {subtitle ?? <span>&nbsp;</span>}
          </p>
        </div>

        {/* What can be done to the open item */}
        {actions}

        {/* The way through the list, in the order the list shows it */}
        <div className="mx-auto flex shrink-0 items-center gap-1 text-xs text-muted sm:mx-0">
          {/* Back one */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('previous')}
            aria-keyshortcuts={STEP_KEYS.previous}
            disabled={!selection.canStep(-1)}
            onClick={() => selection.step(-1)}
          >
            <ChevronLeft size={16} />
          </Button>

          {/* Where it sits in the list */}
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
            aria-keyshortcuts={STEP_KEYS.next}
            disabled={!selection.canStep(1)}
            onClick={() => selection.step(1)}
          >
            <ChevronRight size={16} />
          </Button>

          {/* Any further way through */}
          {stepActions}
        </div>

        {/* Out of the dialog. Last of the controls, so a narrow header wraps it to the far end of their row */}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto sm:ml-0"
          aria-label={tActions('close')}
          onClick={selection.close}
        >
          <X size={16} />
        </Button>
      </header>

      {/* What it holds, once it has arrived */}
      {body ?? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <FetchStatePlaceholder
            uiState={uiState}
            className="flex flex-col items-center gap-2 text-center"
            // An item that arrived empty reads the same way as one still on its way
            empty={<LoadingSpinner />}
            failed={<p className="text-sm text-muted">{failedMessage}</p>}
          />
        </div>
      )}
    </Modal>
  )
}
