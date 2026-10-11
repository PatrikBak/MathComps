'use client'

import { useLocale } from 'next-intl'

import { DefenseChatTrigger } from '@/components/features/defense/components/DefenseChatTrigger'
import type { Locale } from '@/i18n/i18n'

import { hasSolution } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Props for the {@link ProposalChatTrigger} component.
 */
type ProposalChatTriggerProps = {
  /** The problem. */
  proposal: Proposal
}

/**
 * A conversation with Mathilda about a problem, offered only where the problem has a solution in the site's
 * language for her to go by.
 */
export function ProposalChatTrigger({ proposal }: ProposalChatTriggerProps) {
  // The site's language
  const siteLocale = useLocale() as Locale

  // The problem's text in the site's language, if it has one
  const siteText = proposal.texts[siteLocale]

  // No solution in the site's language, so nothing for Mathilda to go by
  if (siteText === undefined || !hasSolution(siteText)) return null

  // The conversation, about the problem's statement in the site's language
  return (
    <DefenseChatTrigger
      problem={{
        target: { kind: 'proposal', problemId: proposal.id },
        statement: siteText.statement,
      }}
    />
  )
}
