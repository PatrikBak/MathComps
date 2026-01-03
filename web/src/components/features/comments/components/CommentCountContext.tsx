'use client'

import { createContext, type ReactNode, useContext } from 'react'

import type { CommentTargetType } from '../api/comment-api-types'
import { useCommentCounts } from '../hooks/use-comment-counts'

/**
 * The shape of the comment count context value.
 */
type CommentCountContextValue = {
  /** The fetched counts as a slug -> count mapping */
  counts: Record<string, number>
  /** Whether the counts are currently loading */
  isLoading: boolean
}

/**
 * Props for the {@link CommentCountProvider} component.
 */
type CommentCountProviderProps = {
  /** The type of targets (Handout, Problem, or News) */
  targetType: CommentTargetType
  /** Array of target slugs to fetch counts for */
  slugs: string[]
  /** Child components that will consume the counts */
  children: ReactNode
}

/**
 * The shape of the comment count returned by {@link useCommentCount}.
 */
type CommentCount = {
  /** The count of comments for the target */
  count: number
  /** Whether the count is currently loading */
  isLoading: boolean
}

/**
 * Context for distributing batch-fetched comment counts to child components.
 */
const CommentCountContext = createContext<CommentCountContextValue | null>(null)

/**
 * Provider that batch-fetches comment counts and distributes them via context.
 * Wrap sections of your UI that display multiple comment counts with this provider.
 */
export function CommentCountProvider({ targetType, slugs, children }: CommentCountProviderProps) {
  // Fetch all counts in a single batch request
  const { data: counts, isLoading } = useCommentCounts(targetType, slugs)

  // Provide the counts to children
  const value: CommentCountContextValue = {
    counts: counts ?? {},
    isLoading,
  }

  // Provide the counts to children
  return <CommentCountContext value={value}>{children}</CommentCountContext>
}

/**
 * Hook to get the comment count for a specific slug from the context.
 * Must be used within a {@link CommentCountProvider}.
 *
 * @param slug - The target slug to get the count for.
 *
 * @returns The count (0 if not found) and loading state.
 */
export function useCommentCount(slug: string): CommentCount {
  // Get the context
  const context = useContext(CommentCountContext)

  // Throw if used outside provider
  if (context === null) {
    throw new Error('useCommentCount must be used within a CommentCountProvider')
  }

  // Return the count and loading state
  return {
    count: context.counts[slug] ?? 0,
    isLoading: context.isLoading,
  }
}
