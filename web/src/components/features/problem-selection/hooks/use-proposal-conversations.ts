'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'
import type { Proposal, ReviewConversation } from '../model/selection-types'

/**
 * What {@link useProposalConversations} hands back.
 */
type UseProposalConversationsResult = {
  /** The conversations held about the problem, newest first. */
  conversations: ReviewConversation[]
  /** The conversation being read; null while none is. */
  opened: ReviewConversation | null
  /** Opens a conversation for reading, by id. */
  openConversation: (conversationId: string) => void
  /** Closes the conversation being read. */
  closeConversation: () => void
  /** Names whoever held a conversation. */
  authorName: (conversation: ReviewConversation) => string
}

/**
 * The conversations reviewers held with Mathilda about one problem, and the one open for reading.
 *
 * @param proposal - The problem the conversations were about.
 *
 * @returns The conversations, the open one, the ways to open and close it, and a way to name each one's author.
 */
export function useProposalConversations(proposal: Proposal): UseProposalConversationsResult {
  // Every problem's conversations, by the problem
  const { conversationsByProposal } = useLoadedSelection()

  // The conversations held about this problem
  const conversations = conversationsByProposal.get(proposal.id) ?? []

  // The conversation being read, by id; null when none is open
  const [openConversationId, setOpenConversationId] = useState<string | null>(null)

  // The conversation being read, if it is still among the problem's conversations
  const opened =
    conversations.find((conversation) => conversation.id === openConversationId) ?? null

  // A function which opens a conversation for reading, by id
  const openConversation = (conversationId: string) => setOpenConversationId(conversationId)

  // A function which closes the conversation being read
  const closeConversation = () => setOpenConversationId(null)

  // Profile copy
  const tProfile = useTranslations('profile')

  // A function which names whoever held a conversation, the default user's name standing in for none
  const authorName = (conversation: ReviewConversation) =>
    conversation.author ?? tProfile('defaultUser')

  // The conversations, the open one, the ways to open and close it, and a way to name each one's author
  return { conversations, opened, openConversation, closeConversation, authorName }
}
