'use client'

import { useLocale } from 'next-intl'

import { DefenseChatTrigger } from '@/components/features/defense/components/DefenseChatTrigger'
import type { Locale } from '@/i18n/i18n'

import { arguedText } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Props for the {@link ProposalChatTrigger} component.
 */
type ProposalChatTriggerProps = {
  /** The problem. */
  proposal: Proposal
}

/**
 * A conversation with Mathilda about a problem, offered only where the problem has a solution for her to go by:
 * in the site's language, or else in the language it was first written in. She talks in the site's language
 * either way.
 */
export function ProposalChatTrigger({ proposal }: ProposalChatTriggerProps) {
  // The site's language
  const siteLocale = useLocale() as Locale

  // The problem's text Mathilda argues it from, if it has one
  const text = arguedText(proposal, siteLocale)

  // No solution in the site's language or the original, so nothing for Mathilda to go by
  if (text === null) return null

  // The conversation, about the statement Mathilda argues from
  return (
    <DefenseChatTrigger
      problem={{
        target: { kind: 'proposal', problemId: proposal.id },
        statement: text.statement,
      }}
    />
  )
}
