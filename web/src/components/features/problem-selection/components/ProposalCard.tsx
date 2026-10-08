'use client'

import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { OPEN_ID_ATTRIBUTE } from '@/hooks/use-focus-return'
import type { Locale } from '@/i18n/i18n'

import type { Proposal } from '../model/selection-types'
import { ProposalFiling } from './ProposalFiling'
import { ProposalStatement } from './ProposalStatement'
import { ProposalSurfaces } from './ProposalSurfaces'
import { ProposalLink } from './SelectionLinks'

/**
 * Props for the {@link ProposalCard} component.
 */
type ProposalCardProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
}

/**
 * A problem as a card: its number and working name, linking to it in full, what it is filed under, where it sits
 * and how much it has been talked about, the statement in full, and the hints and the solution side by side.
 */
export function ProposalCard({ proposal, language }: ProposalCardProps) {
  return (
    <SurfacePanel
      as="article"
      radius="xl"
      className={cn(
        // A set-aside problem, dimmed
        proposal.isSetAside && 'opacity-70'
      )}
    >
      {/* Header */}
      <header className="space-y-1.5 border-b border-foreground/10 px-4 py-3">
        {/* Identity: number and working name, a link opening the problem in full */}
        <div className="flex items-start gap-3">
          <ProposalLink
            proposalId={proposal.id}
            // Named so the pool can come back to it, focus and all, once the problem closes
            {...OPEN_ID_ATTRIBUTE.stamp(proposal.id)}
            className="min-w-0 flex-1 pt-1 text-foreground hyphens-none hover:text-link"
            plain
          >
            <span className="mr-1 text-sm tabular-nums text-muted">{`#${proposal.number}`}</span>{' '}
            <span className="font-medium">{proposal.title}</span>
          </ProposalLink>
        </div>

        {/* Filing line, with the conversation and comment counts */}
        <ProposalFiling proposal={proposal} showCounts />
      </header>

      {/* The statement, always open */}
      <div className="px-4 py-4">
        <ProposalStatement proposal={proposal} language={language} />
      </div>

      {/* The hints and the solution, side by side */}
      <ProposalSurfaces
        proposal={proposal}
        language={language}
        className="border-t border-foreground/10 px-2 py-1.5"
      />
    </SurfacePanel>
  )
}
