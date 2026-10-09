'use client'

import { MoreVertical } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useId } from 'react'

import { useCategoryName } from '@/components/features/hosted-competitions/hooks/use-category-name'
import { HOSTED_COMPETITION_CATEGORIES } from '@/components/features/hosted-competitions/model/hosted-competition-types'
import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'

import { useProposalDeleteConfirmation } from '../hooks/use-proposal-delete-confirmation'
import { useRecommend, useSetAside } from '../hooks/use-proposal-writes'
import type { Proposal } from '../model/selection-types'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link ProposalActionsMenu} component.
 */
type ProposalActionsMenuProps = {
  /** The problem the actions act on. */
  proposal: Proposal
  /** Runs as the delete fires, once the reader confirms it. */
  onDeleted?: () => void
}

/**
 * The rarer things done to a problem: changing the categories it is recommended for, setting it aside,
 * bringing it back, deleting it. A problem a round has taken sits in no pool view and can't be deleted, so
 * it is offered the categories alone.
 */
export function ProposalActionsMenu({ proposal, onDeleted }: ProposalActionsMenuProps) {
  // Actions-menu copy
  const t = useTranslations('problemSelection.actions')

  // The shared names for doing things to something
  const tActions = useTranslations('ui.actions')

  // Recommending the problem for one category, or taking it back
  const recommend = useRecommend()

  // Setting the problem aside, or bringing it back
  const setAside = useSetAside()

  // Deleting the problem, behind a question
  const deletion = useProposalDeleteConfirmation(proposal, onDeleted)

  // Whether any write to the selection is still out, which would drop a press made meanwhile
  const { isWriting } = useSelectionWorkspace()

  // Lists in the reader's language
  const format = useFormatter()

  // What each level is called
  const categoryName = useCategoryName()

  // The id of the label naming the categories' rows
  const recommendedId = useId()

  return (
    <>
      {/* The menu, not modal: a modal one keeps the page hidden from screen readers after the delete question */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            shape="pill"
            aria-label={t('moreFor', { number: proposal.number })}
          >
            <MoreVertical size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {/* The categories the problem is recommended for, each switched on its own and the menu kept open,
              every row unavailable while a write is out */}
          <DropdownMenuGroup aria-labelledby={recommendedId}>
            <p id={recommendedId} className="px-2 pt-1.5 pb-1 text-xs font-semibold text-muted">
              {t('recommendedFor')}
            </p>
            {HOSTED_COMPETITION_CATEGORIES.map((category) => (
              <DropdownMenuCheckboxItem
                key={category}
                checked={proposal.recommended.includes(category)}
                disabled={isWriting}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(isChecked) =>
                  recommend.mutate({
                    proposalId: proposal.id,
                    category,
                    isRecommended: isChecked,
                  })
                }
              >
                {categoryName(category)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>

          {/* Setting the problem aside or bringing it back, and deleting it, while no round has taken it */}
          {!proposal.isUsed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={isWriting}
                onSelect={() =>
                  setAside.mutate({ proposalId: proposal.id, isSetAside: !proposal.isSetAside })
                }
              >
                {proposal.isSetAside ? t('bringBack') : t('setAside')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger" disabled={isWriting} onSelect={deletion.ask}>
                {tActions('delete')}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* The question before a delete */}
      <ConfirmDialog
        isOpen={deletion.isConfirming}
        onClose={deletion.dismiss}
        onConfirm={deletion.confirm}
        title={t('deleteTitle', { number: proposal.number })}
        message={
          deletion.attached.length === 0
            ? t('deleteMessage')
            : t('deleteMessageWithAttached', { attached: format.list(deletion.attached) })
        }
        confirmText={tActions('delete')}
        variant="danger"
      />
    </>
  )
}
