'use client'

import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { Modal } from '@/components/shared/components/Modal'
import { MATHILDA_NAME } from '@/constants/mathilda'
import { useDeferredAnchorJump } from '@/hooks/use-deferred-anchor-jump'
import { ROUTES } from '@/i18n/i18n'

import { useLibraryConversation } from '../hooks/use-library-conversation'
import { useLibrarySelection } from '../hooks/use-library-selection'
import { useMyDefenses } from '../hooks/use-my-defenses'
import type { DefenseSessionListItem } from '../model/defense-types'
import { DefenseConversation } from './DefenseConversation'
import { MathildaDefenseRow } from './MathildaDefenseRow'

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
 * The student's cross-problem list of defenses ("Mathilda"): every defense they've held, most recently active
 * first, each reopening its conversation to continue. A selected defense swaps the same modal to the conversation
 * view, so one dialog serves both and neither stacks over the other, and closing it returns to the list.
 */
export function MathildaLibraryModal({ isOpen, onClose }: MathildaLibraryModalProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Shared action copy, e.g. "Retry"
  const tActions = useTranslations('ui.actions')

  // The user's defenses across every problem, and the controls over them
  const { defenses, uiState, deleteDefense, refresh } = useMyDefenses()

  // Which defense is open, and the row focus returns to on the way back
  const { selected, open, clear, rowRef } = useLibrarySelection()

  // What the chosen defense opens as: the problem to argue and the run it is argued inside
  const conversation = useLibraryConversation(selected)

  // The defense awaiting delete confirmation, or null
  const [toDelete, setToDelete] = useState<DefenseSessionListItem | null>(null)

  // A jump to a problem on the page behind the modal, made once the modal is out of its way
  const { armJump, runArmedJump } = useDeferredAnchorJump()

  // Whether a defense is chosen
  const inConversation = selected !== null

  // Whether the chat has the panel, which brings its own close and title with it
  const isChatShowing = conversation.problem !== null

  // Closes the whole feature, dropping any selection so it reopens on the list
  const handleClose = () => {
    // Back to the list for next time
    clear()

    // Close the feature
    onClose()
  }

  // Arms a jump to a problem on the page behind the modal, closing to get out of its way
  const handleJumpInPage = (anchorId: string) => {
    // Note where the reader is headed
    armJump(anchorId)

    // Close the feature
    handleClose()
  }

  // Deletes the armed defense
  const confirmDelete = () => {
    // Nothing armed
    if (toDelete === null) {
      return
    }

    // Remove it
    deleteDefense(toDelete.id)
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={inConversation ? clear : handleClose}
        title={isChatShowing ? undefined : MATHILDA_NAME}
        ariaLabel={isChatShowing ? t('title') : undefined}
        showCloseButton={!isChatShowing}
        padded={!isChatShowing}
        tall={isChatShowing}
        className={isChatShowing ? undefined : 'max-w-2xl'}
        onClosed={runArmedJump}
      >
        {selected !== null && conversation.problem !== null ? (
          // The real conversation, opened on the chosen defense
          <DefenseConversation
            key={selected.id}
            problem={conversation.problem}
            onClose={clear}
            opening={{ kind: 'named', sessionId: selected.id }}
            competition={conversation.competition}
          />
        ) : selected !== null ? (
          // A chosen defense whose problem is not in hand yet, which is the run a competition one is read
          // against still being read
          <FetchStatePlaceholder
            uiState={conversation.uiState}
            empty={<p className="text-sm text-error">{t('historyError')}</p>}
            failed={<p className="text-sm text-error">{t('historyError')}</p>}
            className="flex flex-col items-center gap-3 py-8 text-center"
          />
        ) : defenses.length === 0 ? (
          // Nothing to list: still on its way, given up on, or genuinely none held yet
          <FetchStatePlaceholder
            uiState={uiState}
            className="flex flex-col items-center gap-3 py-8 text-center"
            empty={
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
            }
            failed={
              <>
                <p className="text-sm text-error">{t('historyError')}</p>
                <Button variant="secondary" size="sm" onClick={refresh}>
                  {tActions('retry')}
                </Button>
              </>
            }
          />
        ) : (
          // The defenses
          <div className="flex flex-col gap-2">
            {defenses.map((defense) => (
              <MathildaDefenseRow
                key={defense.id}
                defense={defense}
                openRef={rowRef(defense)}
                onOpen={open}
                onDelete={setToDelete}
                onClose={handleClose}
                onJumpInPage={handleJumpInPage}
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
