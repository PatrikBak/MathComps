'use client'

import { useLocale } from 'next-intl'

import type { DefenseProblem } from '@/components/features/defense/model/defense-types'
import type { Locale } from '@/i18n/i18n'

import { arguedText } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * What Mathilda talks about with a reviewer of a proposal: the proposal, and the statement she argues it from, in the
 * site's language where it is solved there, or else in the language it was first written in. She talks in the site's
 * language either way.
 *
 * @param proposal - The proposal.
 *
 * @returns The problem to defend, or null where no solution gives Mathilda anything to go by.
 */
export function useProposalDefenseProblem(proposal: Proposal): DefenseProblem | null {
  // The site's language
  const siteLocale = useLocale() as Locale

  // The problem's text Mathilda argues it from, if it has one
  const text = arguedText(proposal, siteLocale)

  // No solution in the site's language or the original, so nothing for Mathilda to go by
  if (text === null) return null

  // The proposal, with the statement Mathilda argues from
  return { target: { kind: 'proposal', problemId: proposal.id }, statement: text.statement }
}
