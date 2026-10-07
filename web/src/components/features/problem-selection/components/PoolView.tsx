'use client'

import { useTranslations } from 'next-intl'

import { COMPACT_PANEL_CLASS } from '@/components/shared/components/FilterEmptyState'
import type { Locale } from '@/i18n/i18n'

import { LanguageSwitch } from './LanguageSwitch'
import { ProposalCard } from './ProposalCard'
import { useSelectionWorkspace } from './SelectionWorkspaceProvider'

/**
 * Props for the {@link PoolView} component.
 */
type PoolViewProps = {
  /** The language the problems are read in. */
  language: Locale
  /** Switches the language the problems are read in. */
  onLanguageChange: (language: Locale) => void
}

/**
 * The pool: every problem still on offer, read statement by statement. Its language switch keeps every language in
 * reach, since a {@link ProposalCard} lacking the one picked shows another the problem has.
 */
export function PoolView({ language, onLanguageChange }: PoolViewProps) {
  // Pool copy
  const t = useTranslations('problemSelection.pool')

  // Counted nouns, which decline with the number in front of them
  const tPlurals = useTranslations('plurals')

  // The selection, if its read has landed
  const { selection } = useSelectionWorkspace()

  // The problems still on offer, leaving out a set-aside one and one a round took; null until the selection arrives
  const shown =
    selection === null
      ? null
      : [...selection.proposalsById.values()].filter(
          (proposal) => !proposal.isSetAside && !proposal.isUsed
        )

  return (
    <div>
      {/* The language statements are read in */}
      <div className="flex justify-end">
        <LanguageSwitch language={language} onChange={onLanguageChange} unwritten={[]} />
      </div>

      {/* The problem count, or a loading line until the pool arrives */}
      <p className="mt-4 mb-3 text-sm text-muted">
        {shown === null ? t('loading') : tPlurals('problems', { count: shown.length })}
      </p>

      {/* The problems, or whatever stands in for them */}
      {shown === null ? (
        // Placeholder cards while the pool loads
        <div className="space-y-4" aria-hidden>
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-48 animate-pulse rounded-xl bg-surface/25" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        // A note that the pool is empty
        <div className={COMPACT_PANEL_CLASS}>
          <p className="text-sm text-muted">{t('emptyPool')}</p>
        </div>
      ) : (
        // A card for every problem on offer
        <div className="space-y-4">
          {shown.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} language={language} />
          ))}
        </div>
      )}
    </div>
  )
}
