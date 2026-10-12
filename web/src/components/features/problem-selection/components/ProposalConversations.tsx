'use client'

import { History } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { useReviewQueueAndNoteFeedSync } from '@/components/features/admin/conversation/hooks/use-review-queue-and-note-feed-sync'
import { ConversationDialog } from '@/components/features/conversation-review/components/ConversationDialog'
import { FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import { useStepHotkeys } from '@/hooks/use-step-hotkeys'

import { useProposalConversations } from '../hooks/use-proposal-conversations'
import type { Proposal } from '../model/selection-types'
import { WARNING_MARK_CLASS } from './CategoryMarks'

/**
 * Props for the {@link ProposalConversations} component.
 */
type ProposalConversationsProps = {
  /** The problem the conversations were about. */
  proposal: Proposal
}

/**
 * Every reviewer's conversation with Mathilda about one problem, newest first, each marked once the problem no
 * longer has the statement it was argued against. Each opens in the conversation dialog, which steps through the
 * rest of the list.
 */
export function ProposalConversations({ proposal }: ProposalConversationsProps) {
  // Conversation copy
  const t = useTranslations('problemSelection.conversations')

  // Dates and times in the reader's language
  const format = useFormatter()

  // The conversations, the open one with its author's others, and each author's name
  const { conversations, selection, author, authorsConversations, authorName } =
    useProposalConversations(proposal)

  // Walking the conversations from the keyboard once one is open, the list sitting on a tab that can be out of sight
  useStepHotkeys(selection, [], false)

  // The review queue and the notes feed, which list these conversations too
  const listSync = useReviewQueueAndNoteFeedSync()

  // Nothing to read yet
  if (conversations.length === 0) {
    return <p className="text-sm text-muted">{t('empty')}</p>
  }

  return (
    <>
      {/* Every conversation, one row each */}
      <ul className="divide-y divide-foreground/5 overflow-hidden rounded-lg bg-surface/30">
        {conversations.map((conversation) => (
          <li key={conversation.id}>
            <button
              type="button"
              {...OPEN_ID_ATTRIBUTE.stamp(conversation.id)}
              onClick={() => selection.open(conversation.id)}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-foreground/5',
                FOCUS_RING_CLASS
              )}
            >
              <span className="font-medium text-foreground">{authorName(conversation)}</span>
              <time dateTime={conversation.startedAt} className="text-muted">
                {format.dateTime(new Date(conversation.startedAt), {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
              {conversation.hasOlderStatement && <OlderStatementMark />}
              <span className="ml-auto text-xs tabular-nums text-muted">
                {t('messages', { count: conversation.messageCount })}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {/* The conversation being read */}
      <ConversationDialog
        selection={selection}
        author={author}
        conversationList={authorsConversations}
        listSync={listSync}
        items="everyConversation"
      />
    </>
  )
}

/**
 * Says a conversation was argued against a statement the problem has since changed.
 */
function OlderStatementMark() {
  // Conversation copy
  const t = useTranslations('problemSelection.conversations')

  return (
    <span
      className={cn(WARNING_MARK_CLASS, 'inline-flex items-center gap-1 px-1.5 py-0.5 text-xs')}
    >
      <History size={12} />
      {t('olderStatement')}
    </span>
  )
}
