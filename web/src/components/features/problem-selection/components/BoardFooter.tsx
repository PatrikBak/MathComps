'use client'

import { useTranslations } from 'next-intl'
import { useId } from 'react'

import { Button } from '@/components/shared/components/Button'
import { localeCodeList } from '@/i18n/i18n'

import { canFinalize, finalizeBlockers } from '../model/selection-state'
import type { Board } from '../model/selection-types'
import { ProposalLink } from './SelectionLinks'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link BoardFooter} component.
 */
type BoardFooterProps = {
  /** The board on screen. */
  board: Board
  /** Opens the finalize dialog. */
  onFinalize: () => void
}

/**
 * What stands between a draft and its cycle's rounds, and the way to send it there, shown only while
 * {@link canFinalize} holds.
 */
export function BoardFooter({ board, onFinalize }: BoardFooterProps) {
  // Board copy
  const t = useTranslations('problemSelection.board')

  // Every proposal by id
  const { proposalsById } = useLoadedSelection()

  // Whether a write changing the slots is still out
  const { isChangingSlots } = useSelectionWorkspace()

  // The id of the list of what still has to happen, which describes the press
  const blockersId = useId()

  // Only a finalizable board shows what stands in its way, every other one leaving the footer a bare gap
  if (!canFinalize(board)) return <div className="h-3" />

  // What stops the board going
  const blockers = finalizeBlockers(board, proposalsById)

  // Whether the board can go, with no slot empty and every problem ready
  const isReady = blockers.emptySlots === 0 && blockers.unready.length === 0

  return (
    <div className="mt-3 space-y-3 border-t border-foreground/10 px-4 py-3">
      {/* What still has to happen, if anything */}
      <ul id={blockersId} className="space-y-1.5 text-xs text-muted">
        {isReady && <li>{t('ready')}</li>}
        {blockers.emptySlots > 0 && <li>{t('emptyCount', { count: blockers.emptySlots })}</li>}
        {blockers.unready.map(({ proposal, languages }) => (
          <li key={proposal.id} className="flex gap-1.5">
            {/* The problem's number, opening it in full */}
            <ProposalLink
              proposalId={proposal.id}
              className="text-link hover:text-link-hover"
              plain
            >
              {`#${proposal.number}`}
            </ProposalLink>

            {/* What the problem still needs */}
            <span>{t('needsLanguages', { languages: localeCodeList(languages) })}</span>
          </li>
        ))}
      </ul>

      {/* The press opening the finalize dialog, unavailable by its ARIA state alone, so the focus a closing
          dialog hands back to it still lands once a refusal has left the board unable to go */}
      <Button
        variant="primary"
        size="sm"
        fullWidth
        aria-disabled={!isReady || isChangingSlots}
        aria-describedby={blockersId}
        onClick={onFinalize}
      >
        {t('finalize')}
      </Button>
    </div>
  )
}
