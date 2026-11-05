import { useCallback } from 'react'

import type { NumberReferenceRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import type { Locale } from '@/i18n/i18n'

import { ProposalReference } from '../components/ProposalReference'

/**
 * What a `#N` in the selection's discussions is drawn as: the `#N` previewing the statement of the problem numbered N,
 * in the language the problems are read in. It changes only with the language, so a new read of the selection redraws
 * no comment, and each `#N` in one follows the read by itself.
 *
 * @param language - The language the problems are read in.
 *
 * @returns The way to draw a `#N`.
 */
export function useProposalReference(language: Locale): NumberReferenceRenderer {
  // A function which draws a `#N` as its problem's preview
  return useCallback(
    (number: number) => <ProposalReference number={number} language={language} />,
    [language]
  )
}
