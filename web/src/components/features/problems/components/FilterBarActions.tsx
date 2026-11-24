import { Check, FilterX, Grid3X3, Link, Rows3, Share2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, type ReactNode } from 'react'

import {
  type Choice,
  ChoiceMenu,
  ChoiceMenuGroup,
  type ChoiceMenuOption,
} from '@/components/shared/components/ChoiceMenu'
import { DropdownMenuItem, DropdownMenuItemIcon } from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { useFittedRow } from '@/hooks/use-fitted-row'

import { useMarkStatusNames } from '../hooks/use-mark-status-names'
import { useShareFilters } from '../hooks/use-share-filters'
import type { MarkStatusFilter } from '../types/problem-api-types'
import { PROBLEM_CARD_VIEWS, type ProblemCardView } from '../types/problem-card-types'
import type { SearchFiltersState } from '../types/problem-library-types'
import { FilterBarOverflowMenu, type OverflowAction } from './FilterBarOverflowMenu'

/**
 * The shape every button in the bar shares: small, quiet text that a hover lifts.
 */
export const BAR_BUTTON_CLASS = cn(
  'inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs',
  'hover:bg-foreground/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
  'disabled:pointer-events-none disabled:opacity-30'
)

/**
 * The colour of a bar button that carries no state of its own.
 */
export const BAR_BUTTON_MUTED_CLASS = 'text-muted hover:text-muted-foreground'

/**
 * The mark status a menu picks, or `all` for every problem alike.
 */
type MarkStatusChoice = MarkStatusFilter | 'all'

/**
 * The colour of each mark status's option while it is the one picked.
 */
const MARK_STATUS_CHECKED_CLASSES: Record<MarkStatusFilter, string> = {
  marked: 'data-[state=checked]:text-success',
  unmarked: 'data-[state=checked]:text-warning',
}

/**
 * One action of the bar, drawn on the bar where it has room and in the overflow menu where it hasn't.
 */
type BarAction = OverflowAction & {
  /** The action as it stands on the bar. */
  onBar: ReactNode
}

/**
 * The props of {@link FilterBarActions}.
 */
type FilterBarActionsProps = {
  /** The filters currently applied. */
  filters: SearchFiltersState
  /** Applies a mark status, or clears the filter on null. */
  onMarkStatusChange: (status: MarkStatusFilter | null) => void
  /** Whether anything is filtering, which is what there is to reset. */
  canReset: boolean
  /** Clears every filter, the favorites or list being browsed staying. */
  onReset: () => void
  /** How the problems' cards are drawn. */
  cardView: ProblemCardView
  /** Draws the problems' cards another way. */
  onCardViewChange: (view: ProblemCardView) => void
  /** Whether technique tags show on every card. */
  showTechniqueTags: boolean
  /** Shows technique tags on every card, or hides them. */
  onShowTechniqueTagsChange: (show: boolean) => void
  /** Opens the competition browser. */
  onOpenCompetitionBrowser: () => void
  /** Warms the competition browser, ahead of a click that may open it. */
  onPrefetchCompetitionBrowser: () => void
}

/**
 * The actions of the bar over the list, then the reset and the overflow menu. The ones the bar has no room for move
 * into the overflow menu, one at a time from the last, the reset staying on the bar.
 */
export function FilterBarActions({
  filters,
  onMarkStatusChange,
  canReset,
  onReset,
  cardView,
  onCardViewChange,
  showTechniqueTags,
  onShowTechniqueTagsChange,
  onOpenCompetitionBrowser,
  onPrefetchCompetitionBrowser,
}: FilterBarActionsProps) {
  // Translations for the filters
  const tFilters = useTranslations('problems.filters')

  // Translations for the card views
  const tCardView = useTranslations('problems.cardView')

  // The name of each mark status
  const markStatusNames = useMarkStatusNames()

  // The mark status's options, every problem alike first
  const markStatusOptions: ChoiceMenuOption<MarkStatusChoice>[] = [
    { value: 'all', label: tFilters('markStatusAll'), checkedClass: null },
    {
      value: 'marked',
      label: markStatusNames.marked,
      checkedClass: MARK_STATUS_CHECKED_CLASSES.marked,
    },
    {
      value: 'unmarked',
      label: markStatusNames.unmarked,
      checkedClass: MARK_STATUS_CHECKED_CLASSES.unmarked,
    },
  ]

  // The mark status as a choice
  const markStatusChoice: Choice<MarkStatusChoice> = {
    name: tFilters('markStatus'),
    value: filters.markStatus ?? 'all',
    options: markStatusOptions,
    onChange: (status) => onMarkStatusChange(status === 'all' ? null : status),
  }

  // How the cards are drawn, as a choice
  const cardViewChoice: Choice<ProblemCardView> = {
    name: tCardView('label'),
    value: cardView,
    options: PROBLEM_CARD_VIEWS.map((view) => ({
      value: view,
      label: tCardView(view),
      checkedClass: null,
    })),
    onChange: onCardViewChange,
  }

  // Translations for the shared actions
  const tActions = useTranslations('ui.actions')

  // A function which copies a link to the library under the filters, its cards drawn as they are now
  const shareFilters = useShareFilters({ filters, cardView })

  // The bar's actions in their order on it, which is the order a narrowing bar keeps them in: the filter first, the
  // least used last
  const actions: BarAction[] = [
    {
      key: 'markStatus',
      onBar: (
        <ChoiceMenu
          {...markStatusChoice}
          icon={Check}
          triggerClassName={cn(BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS)}
        />
      ),
      rows: <ChoiceMenuGroup {...markStatusChoice} />,
    },
    {
      key: 'competitions',
      onBar: (
        <button
          onClick={onOpenCompetitionBrowser}
          onMouseEnter={onPrefetchCompetitionBrowser}
          className={cn(BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS)}
          title={tFilters('competitionsOverview')}
        >
          <Grid3X3 className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{tFilters('competitions')}</span>
        </button>
      ),
      rows: (
        <DropdownMenuItem onSelect={onOpenCompetitionBrowser}>
          <DropdownMenuItemIcon>
            <Grid3X3 className="h-4 w-4" />
          </DropdownMenuItemIcon>
          {tFilters('competitionsOverview')}
        </DropdownMenuItem>
      ),
    },
    {
      key: 'cardView',
      onBar: (
        <ChoiceMenu
          {...cardViewChoice}
          icon={Rows3}
          triggerClassName={cn(BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS)}
        />
      ),
      rows: <ChoiceMenuGroup {...cardViewChoice} />,
    },
    {
      key: 'share',
      onBar: (
        <button
          onClick={shareFilters}
          className={cn(BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS)}
          aria-label={tActions('share')}
          title={tActions('share')}
        >
          <Link className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{tActions('share')}</span>
        </button>
      ),
      rows: (
        <DropdownMenuItem onSelect={shareFilters}>
          <DropdownMenuItemIcon>
            <Share2 className="h-4 w-4" />
          </DropdownMenuItemIcon>
          {tActions('share')}
        </DropdownMenuItem>
      ),
    },
  ]

  // How many of the actions keep their place on their row, the reset pinned at its end
  const { attachRow, visibleCount } = useFittedRow<HTMLDivElement>({
    itemCount: actions.length + 1,
    pinnedCount: 1,
  })

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-x-0 min-[400px]:gap-x-1 sm:gap-x-1.5">
      {/* The actions with room on the row, then the reset, padded so their focus rings clear its clipping */}
      <div
        ref={attachRow}
        className={cn(
          '-m-1 flex min-w-0 flex-1 items-center justify-end overflow-hidden p-1',
          'gap-x-0 min-[400px]:gap-x-1 sm:gap-x-1.5'
        )}
      >
        {actions.slice(0, visibleCount).map((action) => (
          <Fragment key={action.key}>{action.onBar}</Fragment>
        ))}
        <button
          onClick={onReset}
          disabled={!canReset}
          className={cn(BAR_BUTTON_CLASS, BAR_BUTTON_MUTED_CLASS)}
          aria-label={tFilters('resetFilters')}
          title={tFilters('resetFilters')}
        >
          <FilterX className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{tFilters('reset')}</span>
        </button>
      </div>

      {/* Overflow menu, holding the actions the row has no room for */}
      <FilterBarOverflowMenu
        overflowActions={actions.slice(visibleCount)}
        showTechniqueTags={showTechniqueTags}
        onShowTechniqueTagsChange={onShowTechniqueTagsChange}
      />
    </div>
  )
}
