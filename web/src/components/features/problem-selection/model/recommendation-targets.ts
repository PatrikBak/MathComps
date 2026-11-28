import { assertNever } from '@/components/shared/utils/assert-never'

import { categoryHue, isDraft } from './selection-state'
import type { Board, Paper, Proposal, SelectionCategory } from './selection-types'

/**
 * One of the selection's categories, as something a problem can be recommended for.
 */
type CategoryTarget = {
  /** Tells the target apart from a paper. */
  kind: 'category'
  /** The category. */
  category: SelectionCategory
}

/**
 * A paper with no category.
 */
type PaperWithoutCategory = Paper & {
  /** No category. */
  category: null
}

/**
 * A draft's paper with no category, as something a problem can be recommended for, which makes it its own category.
 */
type PaperTarget = {
  /** Tells the target apart from a category. */
  kind: 'paper'
  /** The paper. */
  paper: PaperWithoutCategory
}

/**
 * Something a problem can be recommended for: one of the selection's categories, or a draft's paper with no category.
 */
export type RecommendationTarget = CategoryTarget | PaperTarget

/**
 * Everything a problem can be recommended for, in the order it runs: the selection's categories, then each draft's
 * paper with no category. A finalized board's paper takes no recommendations, so a finished round stops gathering
 * problems.
 *
 * @param categories - The selection's categories, in the order they run.
 * @param boards - The selection's boards, oldest first.
 *
 * @returns The targets, the categories first, then the papers board by board, each board's in its order.
 */
export function recommendationTargetsOf(
  categories: readonly SelectionCategory[],
  boards: readonly Board[]
): RecommendationTarget[] {
  // Each category in the order they run, then each paper that is its own target
  return [
    ...categories.map((category): RecommendationTarget => ({ kind: 'category', category })),
    ...boards
      .flatMap((board) =>
        board.papers.filter((paper): paper is PaperWithoutCategory => isOwnTarget(paper, board))
      )
      .map((paper): RecommendationTarget => ({ kind: 'paper', paper })),
  ]
}

/**
 * Whether a paper is its own recommendation target: one with no category, while its board is a draft.
 *
 * @param paper - The paper.
 * @param board - The board holding the paper.
 *
 * @returns True for a draft's paper with no category.
 */
function isOwnTarget(paper: Paper, board: Board): paper is PaperWithoutCategory {
  // No category, on a board still open to changes
  return paper.category === null && isDraft(board)
}

/**
 * The key a target goes by: a category's name, or a paper's id. A category's name is a word and a paper's id a uuid,
 * so one list of keys can hold both.
 *
 * @param target - The target.
 *
 * @returns The key.
 */
export function targetKeyOf(target: RecommendationTarget): string {
  // By the kind of target
  switch (target.kind) {
    case 'category':
      return target.category.name
    case 'paper':
      return target.paper.id

    // Every kind is handled above
    default:
      return assertNever(target)
  }
}

/**
 * The hue a recommendation target wears: a category its own, a paper none.
 *
 * @param categories - The selection's categories, in the order they run.
 * @param target - The target.
 *
 * @returns The hue's index, from zero; null for a paper.
 */
export function targetHue(
  categories: readonly SelectionCategory[],
  target: RecommendationTarget
): number | null {
  // By the kind of target
  switch (target.kind) {
    case 'category':
      return categoryHue(categories, target.category.name)
    case 'paper':
      return null

    // Every kind is handled above
    default:
      return assertNever(target)
  }
}

/**
 * The keys of everything a proposal is recommended for.
 *
 * @param proposal - The proposal.
 *
 * @returns Its categories' names, then its papers' ids.
 */
export function recommendedKeysOf(proposal: Proposal): string[] {
  // The categories it is recommended for, then the papers
  return [...proposal.recommendedCategories, ...proposal.recommendedPapers]
}

/**
 * The key of the target whose problems a paper takes: its category, or the paper itself while it has none and its
 * board is a draft.
 *
 * @param paper - The paper.
 * @param board - The board holding the paper.
 *
 * @returns The key; null for a finalized board's paper with no category, which takes no recommended problems.
 */
export function paperTargetKeyOf(paper: Paper, board: Board): string | null {
  // The category's name, else the paper's own id where it is its own target, else none
  return paper.category ?? (isOwnTarget(paper, board) ? paper.id : null)
}
