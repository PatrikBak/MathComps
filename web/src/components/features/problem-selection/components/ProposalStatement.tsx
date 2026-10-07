'use client'

import { useTranslations } from 'next-intl'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import type { Locale } from '@/i18n/i18n'

import { resolveText } from '../model/selection-state'
import type { Proposal } from '../model/selection-types'

/**
 * Props for the {@link ProposalStatement} component.
 */
type ProposalStatementProps = {
  /** The problem. */
  proposal: Proposal
  /** The language the problem is being read in. */
  language: Locale
}

/**
 * A problem's statement in the language being read, typeset compactly with its math and figures, under a note
 * when another language has to stand in.
 */
export function ProposalStatement({ proposal, language }: ProposalStatementProps) {
  // Copy for the statement's fallbacks
  const t = useTranslations('problemSelection.text')

  // The problem's text in the language being read, or in the first one it has
  const resolved = resolveText(proposal, language)

  // Nothing written in any language yet
  if (resolved === null) return <p className="text-sm text-muted italic">{t('none')}</p>

  return (
    <>
      {/* Which language stood in, when the one being read has nothing */}
      {resolved.language !== language && (
        <p className="mb-2 text-xs text-muted">
          {t('fallback', {
            missing: language.toUpperCase(),
            shown: resolved.language.toUpperCase(),
          })}
        </p>
      )}

      {/* The statement itself */}
      <div className="math-typography math-reference">
        <RichMathEditorRenderer content={resolved.text.statement} imageContext="problems" />
      </div>
    </>
  )
}
