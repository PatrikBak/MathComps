'use client'

import { ArrowUpRight, Bot, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import type { RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { ENVIRONMENT_TEXT_COLOR } from '@/components/features/handouts/handout-colors'
import { resolveHandoutProblemRef } from '@/components/features/handouts/handout-problem-ref'
import { buildEnvironmentLabels } from '@/components/features/handouts/handout-utils'
import { AppLink } from '@/components/shared/components/AppLink'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import { toPlainTextPreview } from '@/components/shared/utils/string-utils'
import { type Locale, ROUTES } from '@/i18n/i18n'

import { useMyDefenses } from '../hooks/use-my-defenses'
import type { DefenseProblem, DefenseSessionListItem } from '../model/defense-types'
import { DefenseConversation } from './DefenseConversation'

/**
 * Props for the {@link MathildaLibraryModal}.
 */
type MathildaLibraryModalProps = {
  /** Whether the modal is open. */
  isOpen: boolean
  /** Closes the whole feature. */
  onClose: () => void
}

/**
 * Props for the {@link MathildaDefenseRow}.
 */
type MathildaDefenseRowProps = {
  /** The defense this row stands for. */
  defense: DefenseSessionListItem
  /** Holds this row's control when it is the one to return focus to, else null. */
  openRef: RefObject<HTMLButtonElement | null> | null
  /** Opens this defense's conversation. */
  onOpen: (defense: DefenseSessionListItem) => void
  /** Arms the delete confirmation for this defense. */
  onDelete: (defense: DefenseSessionListItem) => void
  /** Closes the list. */
  onClose: () => void
}

/**
 * One row in the list of a user's defenses: which handout and problem it was about, a glimpse of the conversation,
 * its date, and trailing controls. The problem's label carries its environment's color, the same one the handout
 * gives that heading. Clicking the row opens the conversation; the trailing jump goes to the problem in its handout,
 * and the trash removes the defense.
 */
function MathildaDefenseRow({
  defense,
  openRef,
  onOpen,
  onDelete,
  onClose,
}: MathildaDefenseRowProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Handout-surface copy
  const tHandouts = useTranslations('handouts')

  // The active locale
  const locale = useLocale() as Locale

  // Locale-aware value formatter
  const format = useFormatter()

  // The handout location this defense was about, or null when its handout is unknown in this locale
  const ref = resolveHandoutProblemRef(defense.problemKey, locale)

  // The localized environment word per type, e.g. "Úloha" / "Theorem"
  const environmentLabels = buildEnvironmentLabels(tHandouts)

  // The handout name, or a marker that it's gone from the site: the conversation outlives its handout
  const handoutTitle = ref?.handoutTitle ?? t('libraryDeletedHandout')

  // Which environment within that handout
  const environmentLabel =
    ref === null ? null : `${environmentLabels[ref.environmentType]} ${ref.environmentNumber}`

  // A glimpse of the conversation: the student's first message, stripped to plain text
  const preview = toPlainTextPreview(defense.firstStudentMessage ?? '')

  // When the defense was started, to the minute so same-day defenses stay apart
  const startedAt = format.dateTime(new Date(defense.createdAt), {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  return (
    <div className="group flex flex-col gap-2 rounded-lg bg-foreground/5 px-3.5 py-2.5 transition-colors hover:bg-foreground/10 min-[400px]:flex-row min-[400px]:items-stretch min-[400px]:gap-3 min-[400px]:pl-4 min-[400px]:pr-3">
      {/* Open the conversation */}
      <button
        ref={openRef}
        type="button"
        onClick={() => onOpen(defense)}
        className={cn(
          'flex min-w-0 flex-1 flex-col items-start gap-0.5 rounded-md text-left',
          FOCUS_RING_CLASS
        )}
      >
        {/* Which handout, and which problem within it */}
        <span className="flex w-full items-baseline gap-2">
          <span className="truncate font-medium text-foreground">{handoutTitle}</span>
          {environmentLabel && ref !== null && (
            <span className={cn('shrink-0', ENVIRONMENT_TEXT_COLOR[ref.environmentType])}>
              {environmentLabel}
            </span>
          )}
        </span>

        {/* A glimpse of the conversation */}
        <span className="w-full truncate text-sm text-muted">{preview}</span>
      </button>

      {/* The stamp and its controls: a footer under the text until the row is wide enough to hold them beside it */}
      <div className="flex shrink-0 items-center justify-between gap-2 min-[400px]:flex-col min-[400px]:items-end min-[400px]:gap-1">
        <time dateTime={defense.createdAt} className="text-[11px] leading-none text-muted">
          {startedAt}
        </time>

        {/* Jump and delete */}
        <div className="-my-1 flex items-center text-muted">
          {/* Jump straight to the problem in its handout, offered only where that page exists */}
          {ref?.handoutSlug && (
            <AppLink
              href={`${ROUTES.HANDOUTS}/${ref.handoutSlug}#${ref.anchorId}`}
              plain
              aria-label={t('goToHandout')}
              onClick={onClose}
              className={cn(
                'flex size-11 items-center justify-center rounded-md transition-colors hover:bg-foreground/10 hover:text-foreground',
                FOCUS_RING_CLASS
              )}
            >
              <ArrowUpRight size={16} />
            </AppLink>
          )}

          {/* Delete the defense */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('deleteSession')}
            onClick={() => onDelete(defense)}
            className="size-11 hover:bg-error/10 hover:text-error"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * The student's cross-problem list of defenses ("Mathilda"): every defense they've held, newest first, each
 * reopening its conversation to continue. A selected defense swaps the same modal to the conversation view, so
 * one dialog serves both and neither stacks over the other, and closing it returns to the list.
 */
export function MathildaLibraryModal({ isOpen, onClose }: MathildaLibraryModalProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Shared action copy, e.g. "Retry"
  const tActions = useTranslations('ui.actions')

  // The user's defenses across every problem, and the controls over them
  const { defenses, isLoading, isError, deleteDefense, refresh } = useMyDefenses()

  // The defense whose conversation is open, or null while the list is shown
  const [selected, setSelected] = useState<DefenseSessionListItem | null>(null)

  // The row of the last opened defense
  const rowToRefocus = useRef<HTMLButtonElement | null>(null)

  // Which defense that row stands for
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null)

  // The defense awaiting delete confirmation, or null
  const [toDelete, setToDelete] = useState<DefenseSessionListItem | null>(null)

  // Whether the conversation view is showing instead of the list
  const inConversation = selected !== null

  // Returning from a conversation unmounts the control that had focus, so put it back on the row it came from
  useEffect(() => {
    // Only the swap back to the list has a row to return to
    if (inConversation) {
      return
    }

    // Hand focus to the row that was open, if it is still listed
    rowToRefocus.current?.focus()
  }, [inConversation])

  // Opens a defense's conversation, noting the row so focus can return to it
  const handleOpen = (defense: DefenseSessionListItem) => {
    // Note the row focus comes back to
    setLastOpenedId(defense.id)

    // Show the conversation
    setSelected(defense)
  }

  // Closes the whole feature, dropping any selection so it reopens on the list
  const handleClose = () => {
    // Back to the list for next time
    setSelected(null)

    // Close the feature
    onClose()
  }

  // Deletes the armed defense
  const confirmDelete = async () => {
    // Nothing armed
    if (toDelete === null) {
      return
    }

    // Remove it
    try {
      await deleteDefense(toDelete.id)
    } catch {
      // Tell the student it didn't take
      toast.error(t('deleteError'))
    }
  }

  // Returns to the list when the open defense turns out to be gone, refreshing it so the row that led here goes too
  const handleSessionGone = () => {
    // Show the list again
    setSelected(null)

    // Drop the defense that is no longer there from it
    refresh()
  }

  // The problem to hand the conversation when a defense is open: only its key and the statement snapshotted onto
  // the session. The reference solution stays with the problem, which is why the conversation may only continue
  // this session and never open a fresh one.
  const conversationProblem: DefenseProblem | null =
    selected === null
      ? null
      : {
          key: selected.problemKey,
          statement: selected.statement,
          reference: '',
          hints: [],
        }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={inConversation ? () => setSelected(null) : handleClose}
        title={inConversation ? undefined : t('name')}
        ariaLabel={inConversation ? t('title') : undefined}
        showCloseButton={!inConversation}
        padded={!inConversation}
        tall={inConversation}
        className={inConversation ? undefined : 'max-w-2xl'}
      >
        {selected !== null && conversationProblem !== null ? (
          // The real conversation, reopened to the chosen session and continue-only
          <DefenseConversation
            key={selected.id}
            problem={conversationProblem}
            isOpen={isOpen}
            onClose={() => setSelected(null)}
            mode={{
              kind: 'continueSaved',
              sessionId: selected.id,
              onSessionGone: handleSessionGone,
            }}
          />
        ) : isLoading ? (
          // Still fetching the list
          <p className="py-8 text-center text-sm text-muted">{t('libraryLoading')}</p>
        ) : isError && defenses.length === 0 ? (
          // Nothing to fall back on, so the failure is all there is to show; a refetch is the way out
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-error">{t('historyError')}</p>
            <Button variant="secondary" size="sm" onClick={refresh}>
              {tActions('retry')}
            </Button>
          </div>
        ) : defenses.length === 0 ? (
          // No defenses held yet
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-foreground/10 bg-surface/30 px-8 py-14 text-center">
            <Bot size={36} className="mb-4 text-brand-light" />
            <p className="text-base font-medium text-foreground">{t('libraryEmptyLead')}</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted hyphens-none">
              {t.rich('libraryEmpty', {
                link: (chunks) => (
                  <AppLink
                    href={ROUTES.HANDOUTS}
                    plain
                    className="text-link underline transition-colors hover:text-link-hover"
                  >
                    {chunks}
                  </AppLink>
                ),
              })}
            </p>
          </div>
        ) : (
          // The defenses, newest first
          <div className="flex flex-col gap-2">
            {defenses.map((defense) => (
              <MathildaDefenseRow
                key={defense.id}
                defense={defense}
                openRef={defense.id === lastOpenedId ? rowToRefocus : null}
                onOpen={handleOpen}
                onDelete={setToDelete}
                onClose={handleClose}
              />
            ))}
          </div>
        )}
      </Modal>

      {/* Confirmation for a delete, kept outside the modal content so it survives the list re-rendering */}
      <ConfirmDialog
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title={t('deleteSessionTitle')}
        message={t('deleteSessionMessage')}
        variant="danger"
      />
    </>
  )
}
