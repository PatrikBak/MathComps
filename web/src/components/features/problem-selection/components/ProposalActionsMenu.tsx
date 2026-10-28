'use client'

import { useDisclosure } from '@mantine/hooks'
import { Bot, MoreVertical } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useId } from 'react'

import { DefenseChatModal } from '@/components/features/defense/components/DefenseChatModal'
import { MathildaWordmark } from '@/components/features/defense/components/MathildaWordmark'
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
import { dataAttribute } from '@/components/shared/utils/dom-utils'
import { MATHILDA_NAME } from '@/constants/mathilda'
import { useMinWidth } from '@/hooks/use-breakpoint'

import { useCategoryLabel } from '../hooks/use-category-label'
import { useOwnRating } from '../hooks/use-own-rating'
import { useProposalDefenseProblem } from '../hooks/use-proposal-defense-problem'
import { useProposalDeleteConfirmation } from '../hooks/use-proposal-delete-confirmation'
import { useRecommend, useSetAside } from '../hooks/use-proposal-writes'
import { canPlaceOn } from '../model/selection-state'
import { type Proposal, RATING_ASPECTS } from '../model/selection-types'
import { ScoreBar } from './ScoreBar'
import { useLoadedSelection, useSelectionWorkspace } from './SelectionWorkspaceProvider'
import { SlotGrid } from './SlotGrid'

/** Marks the button opening a problem's menu of actions, by the problem's id. */
export const ACTIONS_MENU_ATTRIBUTE = dataAttribute('data-proposal-actions')

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
 * bringing it back, deleting it. On a phone, where the card has no room for them beside its name, the menu also opens
 * the conversation with Mathilda and puts the problem onto the draft on screen while no slot waits for one. Only a lead
 * of some category changes a problem's categories, sets it aside or deletes it, whatever the problem is recommended
 * for, so everyone else is offered the rating alone. A problem a round has taken sits in no pool view and can't be deleted, so a lead is
 * offered its categories and the rating alone.
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

  // Whether a write changing the slots is still out, which would drop a delete made meanwhile, and the slot waiting
  // for a problem
  const { isChangingSlots, waitingSlot } = useSelectionWorkspace()

  // Lists in the reader's language
  const format = useFormatter()

  // The selection's categories in the order they run, the ones the reader leads, and the draft on screen
  const { categories, leadCategories, activeBoard } = useLoadedSelection()

  // Whether the reader leads any category, whatever the problem is recommended for
  const isLead = leadCategories.length > 0

  // What each category is called
  const categoryLabel = useCategoryLabel()

  // The id of the label naming the categories' rows
  const recommendedId = useId()

  // Whether the screen is a phone's, where the card's own buttons for Mathilda and for placing move in here
  const isPhone = !useMinWidth('sm')

  // What Mathilda would talk about, if anything
  const defenseProblem = useProposalDefenseProblem(proposal)

  // Whether the conversation with Mathilda opened from the menu is open, and the ways to open and close it
  const [isChatOpen, chat] = useDisclosure(false)

  // Whether the grid puts the problem onto the draft on screen, which the card's Put in does instead while a slot
  // waits
  const isPlaceable =
    waitingSlot === null &&
    activeBoard !== null &&
    canPlaceOn(activeBoard, proposal, leadCategories)

  // The id of the label naming the slots' grid
  const placeId = useId()

  // Placing copy
  const tPlace = useTranslations('problemSelection.place')

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
            // Found by the problem's id, to take the focus once a placement into the waiting slot on a phone takes the
            // Put in button away
            {...ACTIONS_MENU_ATTRIBUTE.stamp(proposal.id)}
          >
            <MoreVertical size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          {/* On a phone, the card's own buttons: Mathilda, and the slots of the draft on screen */}
          {isPhone && (defenseProblem !== null || isPlaceable) && (
            <>
              {defenseProblem !== null && (
                <DropdownMenuItem
                  // Named as one word, which the wordmark's two colours split in two
                  aria-label={MATHILDA_NAME}
                  textValue={MATHILDA_NAME}
                  className="gap-2"
                  onSelect={chat.open}
                >
                  <Bot size={16} strokeWidth={1.75} />
                  <span>
                    <MathildaWordmark />
                  </span>
                </DropdownMenuItem>
              )}
              {isPlaceable && (
                <DropdownMenuGroup aria-labelledby={placeId}>
                  <p id={placeId} className="px-2 pt-1.5 pb-1 text-xs font-semibold text-muted">
                    {tPlace('label')}
                  </p>
                  <div className="px-2 pb-1.5">
                    <SlotGrid proposal={proposal} board={activeBoard} />
                  </div>
                </DropdownMenuGroup>
              )}
              <DropdownMenuSeparator />
            </>
          )}

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

      {/* The conversation with Mathilda, opened from the menu on a phone */}
      {defenseProblem !== null && (
        <DefenseChatModal problem={defenseProblem} isOpen={isChatOpen} onClose={chat.close} />
      )}

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
  // The reader's scores and the ways to set them
  const rating = useOwnRating(proposal)

  // A bar per aspect
  return RATING_ASPECTS.map((aspect) => (
    <ScoreBar
      key={aspect}
      aspect={aspect}
      score={rating.scores[aspect]}
      onScore={(score) => rating.setScore(aspect, score)}
      onKeyScore={(score) => rating.setKeyScore(aspect, score)}
    />
  ))
}
