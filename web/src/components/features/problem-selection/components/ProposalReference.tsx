'use client'

import type { Locale } from '@/i18n/i18n'

import { useLoadedSelection } from './SelectionWorkspaceProvider'
import { StatementPreview } from './StatementPreview'

/**
 * Props for the {@link ProposalReference} component.
 */
type ProposalReferenceProps = {
  /** The number the `#N` names. */
  number: number
  /** The language the problems are read in. */
  language: Locale
}

/**
 * A `#N` in the selection's discussions: the `#N` previewing the statement of the problem numbered N, or the `#N` as
 * written where no problem of the selection carries the number.
 */
export function ProposalReference({ number, language }: ProposalReferenceProps) {
  // Every problem of the selection
  const { proposalsById } = useLoadedSelection()

  // The problem numbered so
  const proposal = [...proposalsById.values()].find((candidate) => candidate.number === number)

  // The `#N` as people write it
  const label = `#${number}`

  // A number no problem carries, left as written
  if (proposal === undefined) return label

  // The `#N` previewing its problem's statement
  return (
    <StatementPreview proposal={proposal} language={language}>
      {label}
    </StatementPreview>
  )
}
