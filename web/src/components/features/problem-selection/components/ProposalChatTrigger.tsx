'use client'

import { DefenseChatTrigger } from '@/components/features/defense/components/DefenseChatTrigger'

import { useProposalDefenseProblem } from '../hooks/use-proposal-defense-problem'
import type { Proposal } from '../model/selection-types'

/**
 * Props for the {@link ProposalChatTrigger} component.
 */
type ProposalChatTriggerProps = {
  /** The problem. */
  proposal: Proposal
}

/**
 * A conversation with Mathilda about a problem, offered only where the problem has a solution for her to go by.
 */
export function ProposalChatTrigger({ proposal }: ProposalChatTriggerProps) {
  // What Mathilda would talk about, if anything
  const problem = useProposalDefenseProblem(proposal)

  // Nothing for Mathilda to go by
  if (problem === null) return null

  // The conversation about the problem
  return <DefenseChatTrigger problem={problem} />
}
