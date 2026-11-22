// Types for a problem's card: the ways it can be drawn, and what its clicks hand to the filters

import type { MouseEvent } from 'react'

import type { LabeledSlug, TagDto } from './problem-api-types'

/**
 * How a problem's card can be drawn: in full, or compact, as its number, the problem's name and the statement alone.
 */
export const PROBLEM_CARD_VIEWS = ['full', 'compact'] as const

/**
 * One of the {@link PROBLEM_CARD_VIEWS}.
 */
export type ProblemCardView = (typeof PROBLEM_CARD_VIEWS)[number]

/**
 * A function which applies a click on one of a card's tags to the filters, the click saying whether the user asked
 * for that tag alone.
 */
export type TagClickHandler = (tag: TagDto, event: MouseEvent) => void

/**
 * A function which applies a click on one of a card's authors to the filters, the click saying whether the user
 * asked for that author alone.
 */
export type AuthorClickHandler = (author: LabeledSlug, event: MouseEvent) => void
