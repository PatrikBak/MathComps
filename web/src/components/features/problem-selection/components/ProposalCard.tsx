'use client'

import type { ReactNode } from 'react'

import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import type { Locale } from '@/i18n/i18n'

import type { Proposal } from '../model/selection-types'
import { ProposalBody, ProposalBox } from './ProposalBody'
import { ProposalChatTrigger } from './ProposalChatTrigger'
import { ProposalLink, ProposalTabRows } from './SelectionLinks'

/**
 * Props for the {@link ProposalCard} component.
 */
type ProposalCardProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
  /** What stands in front of the problem's name, such as the slot it fills; null for nothing. */
  mark: ReactNode
  /** What can be done to the problem besides talking to Mathilda about it; null for nothing more. */
  actions: ReactNode
  /** A line under the problem's name saying more about it; null for none. */
  details: ReactNode
  /** Classes on the card, for how it stands out where it is. */
  className?: string
}

/**
 * A problem as a card: its number and working name opening it in full, a conversation with
 * Mathilda, and its {@link ProposalBody} with rows for the tabs of the problem's page.
 */
export function ProposalCard({
  proposal,
  language,
  mark,
  actions,
  details,
  className,
}: ProposalCardProps) {
  return (
    <ProposalBox as="article" className={className}>
      {/* Header */}
      <header className="mb-3 space-y-1.5">
        {/* Identity: the mark, the number and working name opening the problem in full, then what can be done to it */}
        <div className="flex items-start gap-3">
          {mark}
          <ProposalLink
            proposalId={proposal.id}
            // Named so whatever the problem was opened from can come back to it, focus and all, once it closes
            {...OPEN_ID_ATTRIBUTE.stamp(proposal.id)}
            className="min-w-0 flex-1 pt-1 text-foreground hyphens-none hover:text-link"
            plain
          >
            <span className="mr-1 text-sm tabular-nums text-muted">{`#${proposal.number}`}</span>{' '}
            <span className="font-medium">{proposal.title}</span>
          </ProposalLink>
          <div className="flex shrink-0 items-center gap-1">
            <ProposalChatTrigger proposal={proposal} />
            {actions}
          </div>
        </div>

        {/* More about the problem, where the card has any */}
        {details}
      </header>

      {/* The statement, and the rows opening the problem's tabs after the hints and the solution */}
      <ProposalBody proposal={proposal} language={language}>
        <ProposalTabRows proposalId={proposal.id} />
      </ProposalBody>
    </ProposalBox>
  )
}
