'use client'

import type { ReactNode } from 'react'

import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import type { Locale } from '@/i18n/i18n'

import type { Proposal } from '../model/selection-types'
import { DetailHeading } from './DetailFrame'
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
  /**
   * Whether the card leads to the problem's own page, its name opening the page and rows opening the page's tabs;
   * false on that page, where the card's name heads the page and the page holds the tabs itself.
   */
  leadsToPage: boolean
  /** What stands in front of the problem's name, such as the slot it fills; null for nothing. */
  mark: ReactNode
  /** What can be done to the problem besides talking to Mathilda about it; null for nothing more. */
  actions: ReactNode
  /** The marks saying more about the problem, on a line under its name. */
  details: ReactNode
  /** Classes on the card, for how it stands out where it is. */
  className?: string
}

/**
 * A problem as a card: its number and working name opening it in full, a conversation with
 * Mathilda, and its {@link ProposalBody} with rows for the tabs of the problem's page. On the problem's own page
 * the name heads the page and the card goes without the rows.
 */
export function ProposalCard({
  proposal,
  language,
  leadsToPage,
  mark,
  actions,
  details,
  className,
}: ProposalCardProps) {
  return (
    <ProposalBox
      // A problem standing on its own, or a part of the problem's own page
      as={leadsToPage ? 'article' : 'section'}
      className={className}
    >
      {/* Header */}
      <header className="mb-3 space-y-1.5">
        {/* Identity: the mark, the number and working name as a link to the problem's page or as that page's heading,
            then what can be done to it */}
        <div className="flex items-start gap-3">
          {mark}
          {leadsToPage ? (
            // The name, opening the problem's page
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
          ) : (
            // The name, heading the problem's page
            <DetailHeading
              subjectId={proposal.id}
              className="min-w-0 flex-1 self-center text-foreground"
            >
              <span className="mr-1 font-normal tabular-nums text-muted">{`#${proposal.number}`}</span>{' '}
              {proposal.title}
            </DetailHeading>
          )}
          <div
            // In the top corner, after the name
            className="ml-auto flex shrink-0 items-center gap-1"
          >
            <ProposalChatTrigger proposal={proposal} />
            {actions}
          </div>
        </div>

        {/* More about the problem */}
        <div className="flex flex-wrap items-center gap-1.5">{details}</div>
      </header>

      {/* The statement, and after the hints and the solution the rows opening the problem's tabs, where the card leads
          to its page */}
      <ProposalBody proposal={proposal} language={language}>
        {leadsToPage && <ProposalTabRows proposalId={proposal.id} />}
      </ProposalBody>
    </ProposalBox>
  )
}
