import type { ProblemCardView } from '../types/problem-card-types'

/**
 * How a problem's card is laid out in one of the {@link ProblemCardView}s.
 */
type ProblemCardLayout = {
  /**
   * Whether the card carries what can be done to the problem, its authors, what it is filed under and the rows under
   * its statement, beside its number, the problem's name and the statement.
   */
  hasDetails: boolean
  /** The card's padding. */
  paddingClass: string
  /** The room between the card's header and the statement. */
  statementGapClass: string
  /** The room under the card, before the next one. */
  spacingBelowClass: string
}

/**
 * How a problem's card is laid out in each view: a compact card is tighter inside and stands closer to the next.
 */
export const PROBLEM_CARD_LAYOUTS: Record<ProblemCardView, ProblemCardLayout> = {
  full: {
    hasDetails: true,
    paddingClass: 'px-4 py-3.5 sm:px-5 sm:py-4',
    statementGapClass: 'mt-3',
    spacingBelowClass: 'pb-4',
  },
  compact: {
    hasDetails: false,
    paddingClass: 'px-4 py-3 sm:px-5',
    statementGapClass: 'mt-2',
    spacingBelowClass: 'pb-2',
  },
}
