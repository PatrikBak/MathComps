import { create } from 'zustand'

import type { Problem } from '@/components/features/problems/types/problem-api-types'

/**
 * State for the global problem store, which represents the problems in the
 * problem library. Should be reseted anytime a user is logged out because
 * the {@link Problem} objects contain user-specific data.
 */
type ProblemState = {
  /* Map of problem slug to Problem object. */
  problems: Record<string, Problem>

  /* Add or update a single problem in the store. */
  upsertProblem: (problem: Problem) => void

  /* Add or update multiple problems in the store. */
  upsertProblems: (problems: Problem[]) => void

  /* Toggle the like state of a problem in the store. */
  toggleProblemLike: (slug: string) => void

  /* Toggle the mark state of a problem in the store. */
  toggleProblemMark: (slug: string) => void

  /* Add or remove a list's contentId from a problem's listContentIds. */
  toggleListMembership: (problemSlug: string, contentId: string) => void

  /* Update the comment count of a problem in the store. */
  updateCommentCount: (slug: string, delta: number) => void

  /* Reset the store to its initial state */
  reset: () => void
}

/**
 * Global store for problem data.
 * This serves as the single source of truth for problem objects.
 * React Query will cache references (slugs) to these objects.
 *
 * @returns A store object with methods to update problems.
 */
export const useProblemStore = create<ProblemState>((set) => ({
  problems: {},

  upsertProblem: (problem) =>
    set((state) => ({
      problems: {
        ...state.problems,
        [problem.slug]: problem,
      },
    })),

  upsertProblems: (newProblems) =>
    set((state) => {
      // Get current problems
      const problems = { ...state.problems }

      // Update them
      newProblems.forEach((problem) => {
        problems[problem.slug] = problem
      })

      // Return the updated state
      return { problems }
    }),

  toggleProblemLike: (problemSlug) =>
    set((state) => {
      // Get the problem from the store
      const problem = state.problems[problemSlug]

      // Ensure the problem is there
      if (!problem) return state

      // Whether the reader likes it now that they have said so
      const isLiked = !problem.liked

      // Update the problem in the store
      const updatedProblems = {
        ...state.problems,
        [problemSlug]: {
          ...problem,
          liked: isLiked,
          likeCount: isLiked ? problem.likeCount + 1 : problem.likeCount - 1,
        },
      }

      // Return the updated state
      return { problems: updatedProblems }
    }),

  toggleProblemMark: (problemSlug) =>
    set((state) => {
      // Get the problem from the store
      const problem = state.problems[problemSlug]

      // Ensure the problem is there
      if (!problem) return state

      // Whether the problem is marked now that the reader has said so
      const isMarked = !problem.marked

      // Update the problem in the store
      const updatedProblems = {
        ...state.problems,
        [problemSlug]: {
          ...problem,
          marked: isMarked,
        },
      }

      // Return the updated state
      return { problems: updatedProblems }
    }),

  toggleListMembership: (problemSlug, contentId) =>
    set((state) => {
      // Get the problem from the store
      const problem = state.problems[problemSlug]

      // Ensure the problem is there
      if (!problem) return state

      // Determine whether to add or remove the contentId
      const isRemoving = problem.listContentIds.includes(contentId)

      // Determine the current list content ids
      const updatedListContentIds = isRemoving
        ? problem.listContentIds.filter((id) => id !== contentId)
        : [...problem.listContentIds, contentId]

      // Return updated state
      return {
        problems: {
          ...state.problems,
          [problemSlug]: {
            ...problem,
            listContentIds: updatedListContentIds,
          },
        },
      }
    }),

  updateCommentCount: (problemSlug, delta) =>
    set((state) => {
      // Get the problem from the store
      const problem = state.problems[problemSlug]

      // Ensure the problem is there
      if (!problem) return state

      // Update the problem in the store
      return {
        problems: {
          ...state.problems,
          [problemSlug]: {
            ...problem,
            commentCount: Math.max(0, problem.commentCount + delta),
          },
        },
      }
    }),

  reset: () =>
    set(() => ({
      problems: {},
    })),
}))

/**
 * Selector hook to get a single problem by slug.
 *
 * @param slug - The slug of the problem to retrieve.
 *
 * @returns The problem corresponding to the provided slug, or undefined if not found.
 */
export const useProblem = (slug: string | null) => {
  return useProblemStore((state) => (slug ? state.problems[slug] : undefined))
}
