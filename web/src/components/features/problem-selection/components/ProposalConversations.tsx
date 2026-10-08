'use client'

import { History, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

import { DefenseTranscript } from '@/components/features/defense/components/DefenseTranscript'
import { EditedSinceNote } from '@/components/features/defense/components/EditedSinceNote'
import { ProblemBand } from '@/components/features/defense/components/ProblemBand'
import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { FetchStatePlaceholder } from '@/components/shared/components/FetchStatePlaceholder'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'
import { MATHILDA_NAME } from '@/constants/mathilda'

import { useProposalConversations } from '../hooks/use-proposal-conversations'
import { useReviewTranscript } from '../hooks/use-review-transcript'
import type { Proposal, ReviewConversation } from '../model/selection-types'
import { WARNING_MARK_CLASS } from './CategoryMarks'

/**
 * Props for the {@link ProposalConversations} component.
 */
type ProposalConversationsProps = {
  /** The problem the conversations were about. */
  proposal: Proposal
}

/**
 * Every reviewer's conversation with Mathilda about one problem, newest first. Each opens read-only under the
 * statement it was argued against, which is marked once the problem no longer has that statement.
 */
export function ProposalConversations({ proposal }: ProposalConversationsProps) {
  // Conversation copy
  const t = useTranslations('problemSelection.conversations')

  // Dates and times in the reader's language
  const format = useFormatter()

  // The conversations, the open one, the ways to open and close it, and each author's name
  const { conversations, opened, openConversation, closeConversation, authorName } =
    useProposalConversations(proposal)

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
              onClick={() => openConversation(conversation.id)}
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
      <ConversationModal
        conversation={opened}
        authorName={authorName}
        onClose={closeConversation}
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

/**
 * Props for the {@link ConversationModal} component.
 */
type ConversationModalProps = {
  /** The conversation being read; null while none is. */
  conversation: ReviewConversation | null
  /** Names whoever held a conversation. */
  authorName: (conversation: ReviewConversation) => string
  /** Closes the conversation. */
  onClose: () => void
}

/**
 * One conversation, read-only, under the statement as it stood when it started, once what was said in it has
 * arrived.
 */
function ConversationModal({ conversation, authorName, onClose }: ConversationModalProps) {
  // Conversation copy
  const t = useTranslations('problemSelection.conversations')

  // Shared action labels
  const tActions = useTranslations('ui.actions')

  // What was said in the open conversation, and how far its read has got
  const { transcript, uiState } = useReviewTranscript(conversation?.id ?? null)

  // Who talked, as a phrase; null while no conversation is open
  const participants =
    conversation === null ? null : t('participants', { author: authorName(conversation) })

  return (
    <Modal
      isOpen={conversation !== null}
      onClose={onClose}
      ariaLabel={participants ?? undefined}
      showCloseButton={false}
      padded={false}
      tall
      // The tall modal's own width applies from the small breakpoint up, so this one overrides it there
      className="sm:max-w-2xl"
    >
      {/* The conversation, while one is open */}
      {conversation !== null && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Who talked, and the way out */}
          <div className="flex items-center gap-3 border-b border-foreground/10 py-2 pr-2 pl-5">
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
              {participants}
            </h3>
            <Button size="icon" variant="ghost" aria-label={tActions('close')} onClick={onClose}>
              <X size={18} />
            </Button>
          </div>

          {/* The note that the problem has changed since */}
          {conversation.hasOlderStatement && <EditedSinceNote />}

          {/* The statement it was argued against and what was said, once they have arrived */}
          {transcript === null ? (
            <div className="flex flex-1 flex-col items-center justify-center">
              <FetchStatePlaceholder
                uiState={uiState}
                className="flex flex-col items-center gap-2 text-center"
                empty={<LoadingSpinner />}
                failed={<p className="text-sm text-muted">{t('transcriptFailed')}</p>}
              />
            </div>
          ) : (
            <>
              {/* The statement it was argued against */}
              <ProblemBand statement={transcript.savedStatement} height="shared" />

              {/* What was said, opening on the first message */}
              <DefenseTranscript
                turns={transcript.turns}
                conversationKey={conversation.id}
                roleLabels={{ examiner: MATHILDA_NAME, candidate: authorName(conversation) }}
                isThinking={false}
                reports={new Map()}
                onRewindTurn={null}
                onReportTurn={null}
                dividers={[]}
                unreadMark={null}
                noteMark={null}
                draftsMark={null}
                turnDurationsMs={null}
                openingTurnId={transcript.turns[0]?.id ?? null}
                footer={null}
              />
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
