'use client'

import { useCommentCount } from '@/components/features/comments/components/CommentCountContext'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'

/**
 * What {@link useDetailTabCounts} hands back: one count per tab, under the tab's name.
 */
type UseDetailTabCountsResult = {
  /** How many conversations reviewers held with Mathilda about the problem. */
  conversations: number
  /** How many comments the problem's discussion holds. */
  comments: number
}

/**
 * How many conversations and comments a problem carries, one count per tab, for a part drawn inside the selection's
 * workspace once the selection has arrived.
 *
 * @param proposalId - The problem.
 *
 * @returns The count for each tab.
 */
export function useDetailTabCounts(proposalId: string): UseDetailTabCountsResult {
  // Every problem's conversations, by the problem
  const { conversationsByProposal } = useLoadedSelection()

  // How many conversations were held about the problem
  const conversations = conversationsByProposal.get(proposalId)?.length ?? 0

  // How many comments the problem's discussion holds
  const { count: comments } = useCommentCount(proposalId)

  // The count for each tab
  return { conversations, comments }
}
