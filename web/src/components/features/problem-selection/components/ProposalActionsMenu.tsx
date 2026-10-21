'use client'

import { MoreVertical } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useId } from 'react'

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

import { useCategoryLabel } from '../hooks/use-category-label'
import { useProposalDeleteConfirmation } from '../hooks/use-proposal-delete-confirmation'
import { useRate, useRecommend, useSetAside } from '../hooks/use-proposal-writes'
import {
  type Proposal,
  RATING_ASPECTS,
  type RatingAspect,
  type RatingScores,
} from '../model/selection-types'
import { ScoreBar } from './ScoreBar'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'

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
 * The rarer things done to a problem: changing the categories it is recommended for, rating it, setting it aside,
 * bringing it back, deleting it. Only a lead of some category changes a problem's categories, sets it aside or
 * deletes it, whatever the problem is recommended for, so everyone else is offered the rating alone. A problem a round
 * has taken sits in no pool view and can't be deleted, so a lead is offered its categories and the rating alone.
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

  // Whether a write changing the slots is still out, which would drop a delete made meanwhile
  const { isChangingSlots } = useSelectionWorkspace()

  // Lists in the reader's language
  const format = useFormatter()

  // The selection's categories in the order they run, and the ones the reader leads
  const { categories, leadCategories } = useLoadedSelection()

  // Whether the reader leads any category, whatever the problem is recommended for
  const isLead = leadCategories.length > 0

  // What each category is called
  const categoryLabel = useCategoryLabel()

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
          {/* The categories the problem is recommended for, each switched on its own and the menu kept open, for a
              lead where the organization lists any */}
          {isLead && categories.length > 0 && (
            <>
              <DropdownMenuGroup aria-labelledby={recommendedId}>
                <p id={recommendedId} className="px-2 pt-1.5 pb-1 text-xs font-semibold text-muted">
                  {t('recommendedFor')}
                </p>
                {categories.map(({ name }) => (
                  <DropdownMenuCheckboxItem
                    key={name}
                    checked={proposal.recommended.includes(name)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={(isChecked) =>
                      recommend.mutate({
                        proposalId: proposal.id,
                        category: name,
                        isRecommended: isChecked,
                      })
                    }
                  >
                    {categoryLabel(name)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}

          {/* The reader's own rating */}
          <RatingRows proposal={proposal} />

          {/* Setting the problem aside or bringing it back, and deleting it, for a lead while no round has
              taken it */}
          {isLead && !proposal.isUsed && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  setAside.mutate({ proposalId: proposal.id, isSetAside: !proposal.isSetAside })
                }
              >
                {proposal.isSetAside ? t('bringBack') : t('setAside')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="danger" disabled={isChangingSlots} onSelect={deletion.ask}>
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

/**
 * Props for the {@link RatingRows} component.
 */
type RatingRowsProps = {
  /** The problem rated. */
  proposal: Proposal
}

/**
 * The reader's own rating of a problem, a bar of scores per aspect.
 */
function RatingRows({ proposal }: RatingRowsProps) {
  // The reader's rating of the problem, if they have rated it
  const ownRating = proposal.ratings.find((rating) => rating.isOwn)

  // The reader's score for each aspect, none where they have given none
  const ownScores: RatingScores = {
    beauty: ownRating?.beauty ?? null,
    difficulty: ownRating?.difficulty ?? null,
  }

  // Rating the problem, or taking the rating back
  const rate = useRate()

  // A function which sets the reader's score for one aspect, keeping the other's, or takes it back
  const setScore = (aspect: RatingAspect, score: number | null) =>
    rate.mutate({ proposalId: proposal.id, scores: { ...ownScores, [aspect]: score } })

  // A bar per aspect
  return RATING_ASPECTS.map((aspect) => (
    <ScoreBar
      key={aspect}
      aspect={aspect}
      score={ownScores[aspect]}
      onScore={(score) => setScore(aspect, score)}
    />
  ))
}
