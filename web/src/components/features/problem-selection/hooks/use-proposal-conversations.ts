'use client'

import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

import type { UseStudentConversationsResult } from '@/components/features/admin/conversation/hooks/use-student-conversations'
import type { UserIdentity } from '@/components/features/admin/model/user-identity'
import { useSteppedSelection, type UseSteppedSelectionResult } from '@/hooks/use-stepped-selection'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'
import type { Proposal, ReviewConversation } from '../model/selection-types'

/**
 * What {@link useProposalConversations} hands back.
 */
type UseProposalConversationsResult = {
  /** The conversations held about the problem, newest first. */
  conversations: ReviewConversation[]
  /** Which conversation is open, and every way of moving off it. */
  selection: UseSteppedSelectionResult
  /** Whoever held the open conversation; null while none is open. */
  author: UserIdentity | null
  /** Every conversation the open one's author held about the problem, oldest first, none of them graded. */
  authorsConversations: UseStudentConversationsResult
  /** Names whoever held a conversation. */
  authorName: (conversation: ReviewConversation) => string
}

/**
 * The conversations reviewers held with Mathilda about one problem, and the one open for reading.
 *
 * @param proposal - The problem the conversations were about.
 *
 * @returns The conversations, the open one with its author's others, and a way to name each one's author.
 */
export function useProposalConversations(proposal: Proposal): UseProposalConversationsResult {
  // Every problem's conversations, by the problem
  const { conversationsByProposal } = useLoadedSelection()

  // The conversations held about this problem
  const conversations = useMemo(
    () => conversationsByProposal.get(proposal.id) ?? [],
    [conversationsByProposal, proposal.id]
  )

  // Their ids, in the order they are listed
  const orderedIds = useMemo(
    () => conversations.map((conversation) => conversation.id),
    [conversations]
  )

  // Which conversation is open, none at first
  const selection = useSteppedSelection(orderedIds, null)

  // The open conversation, if it is still among the problem's conversations
  const opened = conversations.find((conversation) => conversation.id === selection.openId) ?? null

  // An open conversation the problem no longer lists, its holder having deleted it, leaves nothing to read,
  // so it closes
  if (selection.openId !== null && opened === null) selection.close()

  // Whoever held the open conversation, known by the username alone
  const author: UserIdentity | null =
    opened === null ? null : { id: opened.authorId, username: opened.author, email: null }

  // Every conversation the open one's author held about the problem, oldest first, none of them graded
  const authorsConversations: UseStudentConversationsResult = {
    studentConversations:
      opened === null
        ? null
        : {
            conversations: conversations
              .filter((conversation) => conversation.authorId === opened.authorId)
              .map((conversation) => ({ id: conversation.id, createdAt: conversation.startedAt }))
              .reverse(),
            grading: null,
          },
    // Already in hand with the selection
    uiState: { kind: 'ready' },
  }

  // Profile copy
  const tProfile = useTranslations('profile')

  // A function which names whoever held a conversation, the default user's name standing in for none
  const authorName = (conversation: ReviewConversation) =>
    conversation.author ?? tProfile('defaultUser')

  // The conversations, the open one with its author's others, and a way to name each one's author
  return { conversations, selection, author, authorsConversations, authorName }
}
