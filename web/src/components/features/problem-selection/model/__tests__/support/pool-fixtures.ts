import { recommendationTargetsOf } from '../../recommendation-targets'
import type { DiscussedSubject, DiscussionThread } from '../../selection-discussions'
import type { Proposal, SelectionCategory } from '../../selection-types'

/** MathComps' categories, each a hosted level. */
export const MATHCOMPS_CATEGORIES: SelectionCategory[] = [
  { name: 'elementary', hostedCategory: 'elementary' },
  { name: 'intermediate', hostedCategory: 'intermediate' },
  { name: 'advanced', hostedCategory: 'advanced' },
]

/** What a problem can be recommended for at MathComps while no draft holds a paper with no category. */
export const MATHCOMPS = recommendationTargetsOf(MATHCOMPS_CATEGORIES, [])

/**
 * A live proposal in the pool, numbered and named after its number unless told otherwise.
 *
 * @param number - The number it goes by, which its id is built from.
 * @param changes - What sets it apart from a live algebra problem recommended for nothing.
 *
 * @returns The proposal.
 */
export function proposal(number: number, changes: Partial<Proposal> = {}): Proposal {
  // An algebra problem recommended for nothing, with an English statement, and whatever the changes lay on top
  return {
    id: `p${number}`,
    number,
    title: `Problem ${number}`,
    area: 'algebra',
    recommendedCategories: [],
    recommendedPapers: [],
    texts: { en: { statement: `Statement ${number}`, solution: null, hints: [] } },
    originalLanguage: 'en',
    gradingNote: null,
    isSetAside: false,
    isUsed: false,
    ratings: [],
    ...changes,
  }
}

/**
 * The ids of the threads' top-level comments, in the order given.
 *
 * @param threads - The threads.
 *
 * @returns Each thread's top-level comment id.
 */
export function threadIds(threads: DiscussionThread<DiscussedSubject>[]): string[] {
  // Each thread's top-level comment id
  return threads.map((thread) => thread.comment.id)
}
