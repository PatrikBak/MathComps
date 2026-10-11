'use client'

import { useEffect, useState } from 'react'

import { CompetitionHints } from '@/components/features/hosted-competitions/components/CompetitionHints'
import { CompetitionSolution } from '@/components/features/hosted-competitions/components/CompetitionSolution'
import type { Locale } from '@/i18n/i18n'

import { hasSolution, resolveText } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Which of a problem's surfaces is open, null while none is.
 */
type OpenSurface = 'hints' | 'solution' | null

/**
 * Props for the {@link ProposalSurfaces} component.
 */
type ProposalSurfacesProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
}

/**
 * A problem's hints and solution, each a row opening on a surface of its own. The text on them is in the language
 * being read, or the one {@link resolveText} falls back to, and a text with neither leaves no row at all.
 */
export function ProposalSurfaces({ proposal, language }: ProposalSurfacesProps) {
  // Which surface is open
  const [openSurface, setOpenSurface] = useState<OpenSurface>(null)

  // Closed whenever the rows are hidden or leave the page, so rows kept while hidden come back with nothing open
  useEffect(() => () => setOpenSurface(null), [])

  // The text in the language being read, or the first one the problem has
  const resolved = resolveText(proposal, language)

  // Nothing written, so nothing to open
  if (resolved === null) return null

  return (
    <>
      {/* The hints, where the text being read has any */}
      {resolved.text.hints.length > 0 && (
        <CompetitionHints
          position={proposal.number}
          statement={resolved.text.statement}
          hints={resolved.text.hints}
          isOpen={openSurface === 'hints'}
          onOpen={() => setOpenSurface('hints')}
          onClose={() => setOpenSurface(null)}
        />
      )}

      {/* The solution, where the text being read has one */}
      {hasSolution(resolved.text) && (
        <CompetitionSolution
          position={proposal.number}
          statement={resolved.text.statement}
          solution={resolved.text.solution}
          isOpen={openSurface === 'solution'}
          onOpen={() => setOpenSurface('solution')}
          onClose={() => setOpenSurface(null)}
        />
      )}
    </>
  )
}
