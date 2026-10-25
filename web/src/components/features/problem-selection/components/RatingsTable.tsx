'use client'

import { Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { MouseEvent, RefObject } from 'react'

import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { SortHeader } from '@/components/shared/components/SortHeader'
import { Tooltip } from '@/components/shared/components/Tooltip'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'
import { isPlainClick } from '@/components/shared/utils/event-utils'
import type { TableSort } from '@/components/shared/utils/table-sort'
import { useFocusHandOff } from '@/hooks/use-focus-hand-off'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'

import { RATINGS_STARTS_ASCENDING, type RatingsColumn, sortByRatings } from '../model/ratings-order'
import { averageScore } from '../model/selection-state'
import {
  type Proposal,
  type ProposalRating,
  RATING_ASPECTS,
  type RatingAspect,
} from '../model/selection-types'
import { NoScore, RatingBreakdown, Score } from './RatingBreakdown'
import { ProposalLink } from './SelectionLinks'

/**
 * Props for the {@link RatingsTable} component.
 */
type RatingsTableProps = {
  /** The problems, in the order they run, which the table opens in. */
  proposals: readonly Proposal[]
  /** How the rows are ordered. */
  sort: TableSort<RatingsColumn>
  /** Orders the rows as asked. */
  onSort: (sort: TableSort<RatingsColumn>) => void
  /** What takes the focus when a row leaves holding it with no row in its place. */
  fallbackRef: RefObject<HTMLElement | null>
}

/**
 * The problems' ratings as a table: a row per problem with each aspect's average and how many reviewers rated it,
 * ordered by whichever column the reader picks. A plain press anywhere on a row opens its problem, and an average
 * shows who gave what. The raters' column is headed by an icon of people, its name shown on hover and read to
 * assistive tech.
 */
export function RatingsTable({ proposals, sort, onSort, fallbackRef }: RatingsTableProps) {
  // Rating copy
  const t = useTranslations('problemSelection.ratings')

  // The problems in the order asked for
  const rows = sortByRatings(proposals, sort)

  return (
    <div className="-mx-4 overflow-x-auto bg-surface/30 sm:mx-0 sm:rounded-lg">
      <table
        aria-label={t('tableLabel')}
        className="w-full border-collapse text-xs hyphens-none sm:text-sm"
      >
        {/* The columns */}
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-muted sm:text-xs">
            <SortHeader
              label="#"
              by="place"
              sort={sort}
              startsAscending={RATINGS_STARTS_ASCENDING}
              onSort={onSort}
              className="w-px whitespace-nowrap py-2 pl-5 pr-1 text-right font-medium sm:pl-6"
              ariaLabel={t('number')}
              arrowBefore
            />
            <th className="w-full py-2 pl-2 pr-2 font-medium sm:px-3">{t('problem')}</th>
            {RATING_ASPECTS.map((aspect) => (
              <SortHeader
                key={aspect}
                // The aspect's short name on a phone, leaving room for the problem's name
                label={
                  <>
                    <span className="sm:hidden">{t(`${aspect}Short`)}</span>
                    <span className="hidden sm:inline">{t(aspect)}</span>
                  </>
                }
                ariaLabel={t(aspect)}
                by={aspect}
                sort={sort}
                startsAscending={RATINGS_STARTS_ASCENDING}
                onSort={onSort}
                // Room either side for the arrow hanging off the centred name
                className="w-px whitespace-nowrap px-4 py-2 text-center font-medium sm:px-5"
              />
            ))}
            <th
              title={t('raters')}
              className="w-px whitespace-nowrap py-2 pl-2 pr-5 text-center font-medium sm:pr-6"
            >
              <Users size={13} strokeWidth={2.25} className="inline-block" aria-hidden />
              <span className="sr-only">{t('raters')}</span>
            </th>
          </tr>
        </thead>

        {/* A row per problem */}
        <tbody>
          {rows.map((proposal) => (
            <RatingsRow key={proposal.id} proposal={proposal} fallbackRef={fallbackRef} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Props for the {@link RatingsRow} component.
 */
type RatingsRowProps = {
  /** The problem. */
  proposal: Proposal
  /** What takes the focus when the row leaves holding it with no row in its place. */
  fallbackRef: RefObject<HTMLElement | null>
}

/**
 * One problem's row: its number, its name opening it, each aspect's average, and how many rated it. A row leaving the
 * table while it holds the focus hands the focus on as {@link useFocusHandOff} does.
 */
function RatingsRow({ proposal, fallbackRef }: RatingsRowProps) {
  // The focus handed on as the row leaves holding it
  const handOff = useFocusHandOff<HTMLTableRowElement>(fallbackRef)

  return (
    <tr
      {...handOff}
      onClick={openFromRow}
      className="group cursor-pointer border-t border-foreground/5 transition-colors hover:bg-foreground/[0.04]"
    >
      {/* The problem's number */}
      <td className="w-px whitespace-nowrap py-1 pl-5 pr-1 text-right tabular-nums text-foreground sm:py-1.5 sm:pl-6">
        {proposal.number}
      </td>

      {/* The problem's name, opening it */}
      <th
        scope="row"
        className="w-full max-w-0 py-1 pl-2 pr-2 text-left font-normal sm:px-3 sm:py-1.5"
      >
        <ProposalLink
          proposalId={proposal.id}
          // Named so the table can come back to it, focus and all, once the problem closes, and so a press on the
          // row finds it
          {...OPEN_ID_ATTRIBUTE.stamp(proposal.id)}
          className="block text-foreground group-hover:text-link"
          plain
        >
          <TruncatedText className="font-medium">{proposal.title}</TruncatedText>
        </ProposalLink>
      </th>

      {/* Each aspect's average */}
      {RATING_ASPECTS.map((aspect) => (
        <td
          key={aspect}
          className="w-px whitespace-nowrap px-4 py-1 text-center tabular-nums sm:px-5 sm:py-1.5"
        >
          <AspectAverage ratings={proposal.ratings} aspect={aspect} />
        </td>
      ))}

      {/* How many rated it */}
      <td className="w-px whitespace-nowrap py-1 pl-2 pr-5 text-center tabular-nums text-foreground sm:py-1.5 sm:pr-6">
        {proposal.ratings.length === 0 ? <NoScore /> : proposal.ratings.length}
      </td>
    </tr>
  )
}

/**
 * Hands a plain press anywhere on a row to the row's link, which opens the problem. A press the link or an average
 * already acted on, or one held with a modifier, is left as it is.
 *
 * @param event - The press on the row.
 */
function openFromRow(event: MouseEvent<HTMLTableRowElement>) {
  // Acted on already, or held with a modifier
  if (event.defaultPrevented || !isPlainClick(event)) return

  // The row's link, followed
  event.currentTarget.querySelector<HTMLElement>(OPEN_ID_ATTRIBUTE.anySelector)?.click()
}

/**
 * Props for the {@link AspectAverage} component.
 */
type AspectAverageProps = {
  /** The problem's ratings. */
  ratings: readonly ProposalRating[]
  /** The aspect. */
  aspect: RatingAspect
}

/**
 * One aspect's average for a problem, showing who gave what while hovered, focused or pressed. A dash while nobody
 * scored the aspect.
 */
function AspectAverage({ ratings, aspect }: AspectAverageProps) {
  // The aspect's average, none while nobody has scored it
  const average = averageScore(ratings, aspect)

  // Nobody to average, nothing to break down
  if (average === null) return <NoScore />

  // The average, opening the scores behind it
  return (
    <Tooltip placement="top" content={<RatingBreakdown ratings={ratings} aspects={[aspect]} />}>
      <button
        type="button"
        // As tall as a row without one
        className={cn(
          '-my-0.5 rounded-md px-1.5 py-0.5 tabular-nums text-foreground transition-colors',
          'hover:bg-foreground/10',
          FOCUS_RING_CLASS
        )}
      >
        <Score score={average} />
      </button>
    </Tooltip>
  )
}
