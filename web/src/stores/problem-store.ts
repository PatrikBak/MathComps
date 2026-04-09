import { create } from 'zustand'

import type { Problem } from '@/components/features/problems/types/problem-api-types'
import type { SearchFiltersState } from '@/components/features/problems/types/problem-library-types'

/**
 * State for the global problem store, which represents the problems in the
 * problem library. Should be reseted anytime a user is logged out because
 * the {@link Problem} objects contain user-specific data.
 */
type ProblemState = {
  /* Map of problem slug to Problem object. */
  problems: Record<string, Problem>

  /* Current active filters (synced from use-problem-search reducer). */
  currentFilters: SearchFiltersState | null

  /* The slugs of displayed problems (for optimistic updates). */
  displayedProblems: string[]

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

  /* Set the currently displayed problems (called when search results load). */
  setDisplayedProblems: (slugs: string[]) => void

  /* Set the current filters (called when the filter results change) */
  setCurrentFilters: (filters: SearchFiltersState | null) => void

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
  displayedProblems: [],
  currentFilters: null,

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

      // Update the problem in the store
      const updatedProblems = {
        ...state.problems,
        [problemSlug]: {
          ...problem,
          liked: !problem.liked,
          likeCount: problem.liked ? problem.likeCount - 1 : problem.likeCount + 1,
        },
      }

      // We might update the displayed problems if we are filtering by "Liked Only"
      let updatedDisplayed = state.displayedProblems

      // If we are filtering by "Liked Only" (e.g., favorites tab),
      // and we just unliked it, we should remove it from the view immediately.
      if (state.currentFilters?.favoritesOnly && !problem.liked) {
        updatedDisplayed = state.displayedProblems.filter((slug) => slug !== problemSlug)
      }

      // Return the updated state
      return {
        problems: updatedProblems,
        displayedProblems: updatedDisplayed,
      }
    }),

  toggleProblemMark: (problemSlug) =>
    set((state) => {
      // Get the problem from the store
      const problem = state.problems[problemSlug]

      // Ensure the problem is there
      if (!problem) return state

      // Update the problem in the store
      const updatedProblems = {
        ...state.problems,
        [problemSlug]: {
          ...problem,
          marked: !problem.marked,
        },
      }

      // We might update the displayed problems if we are filtering by "Marked Only"
      let updatedDisplayed = state.displayedProblems

      // If we are filtering by "Marked Only" and we just unmarked it,
      // we should remove it from the view immediately.
      if (state.currentFilters?.markStatus === 'marked' && !problem.marked) {
        updatedDisplayed = state.displayedProblems.filter((slug) => slug !== problemSlug)
      }

      // If we are filtering by "Unmarked Only" and we just marked it,
      // we should remove it from the view immediately.
      if (state.currentFilters?.markStatus === 'unmarked' && problem.marked) {
        updatedDisplayed = state.displayedProblems.filter((slug) => slug !== problemSlug)
      }

      // Return the updated state
      return {
        problems: updatedProblems,
        displayedProblems: updatedDisplayed,
      }
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

      // If removing from a list while viewing that list, hide the problem
      let updatedDisplayed = state.displayedProblems
      if (isRemoving && state.currentFilters?.listContentId === contentId) {
        updatedDisplayed = state.displayedProblems.filter((slug) => slug !== problemSlug)
      }

      // Return updated state
      return {
        problems: {
          ...state.problems,
          [problemSlug]: {
            ...problem,
            listContentIds: updatedListContentIds,
          },
        },
        displayedProblems: updatedDisplayed,
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

  setDisplayedProblems: (problemSlugs) =>
    set(() => ({
      displayedProblems: problemSlugs,
    })),

  setCurrentFilters: (filters) =>
    set(() => ({
      currentFilters: filters,
    })),

  reset: () =>
    set(() => ({
      problems: {},
      displayedProblems: [],
      currentFilters: null,
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
