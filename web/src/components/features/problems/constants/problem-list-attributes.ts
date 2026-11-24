import { dataAttribute } from '@/components/shared/utils/dom-utils'

/**
 * The attribute a problem's card carries its problem's slug under, so the card can be found among the rest.
 */
export const PROBLEM_CARD_ATTRIBUTE = dataAttribute('data-problem-slug')

/**
 * The attribute the bar over the list carries how many problems the search matched under, missing while a search runs.
 */
export const PROBLEM_COUNT_ATTRIBUTE = dataAttribute('data-problem-count')
