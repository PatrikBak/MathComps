'use client'

import { Lightbulb } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { DisclosurePanel } from '@/components/features/handouts/Cards'
import { HINT_BADGE, HINT_TEXT_COLOR } from '@/components/features/handouts/handout-colors'
import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import type { Locale, LocalizedString } from '@/i18n/i18n'

import type { LocalizedHints } from '../model/hosted-competition-types'
import { CompetitionProblemSurface } from './CompetitionProblemSurface'

/**
 * Props for the {@link CompetitionHints} component.
 */
type CompetitionHintsProps = {
  /** Which of the set the hints lead into, counting from one. */
  position: number
  /** The statement as markdown/math source, in every language the site is read in. */
  statement: LocalizedString
  /** The author's hints, weakest nudge first, in every language the site is read in. */
  hints: LocalizedHints
  /** Whether this problem is the one whose hints are being read. */
  isOpen: boolean
  /** Opens the hints. */
  onOpen: () => void
  /** Closes the hints. */
  onClose: () => void
}

/**
 * The author's hints towards one of a competition's problems: a line on the problem, and the ladder itself
 * on a surface of its own.
 *
 * Only ever drawn once the student is no longer competing here, which is when a ladder reaches the page at
 * all.
 *
 * Each rung folds away on its own, the way a handout lays out a ladder, down to the colour and the numbered
 * badge.
 */
export function CompetitionHints({
  position,
  statement,
  hints,
  isOpen,
  onOpen,
  onClose,
}: CompetitionHintsProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // The active locale, which decides which language the ladder is read in
  const locale = useLocale() as Locale

  return (
    <CompetitionProblemSurface
      label={t('hints')}
      icon={Lightbulb}
      position={position}
      statement={statement}
      isOpen={isOpen}
      onOpen={onOpen}
      onClose={onClose}
    >
      {/* One rung per hint, each folded away until it is asked for, the badge saying which rung it is. The
          reference typography sits on the list so that a rung's label takes the same size as its text */}
      <div className="math-typography math-reference divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {hints[locale].map((hint, index) => (
          <DisclosurePanel
            key={index}
            label={t('hint')}
            textColorClass={HINT_TEXT_COLOR}
            badge={HINT_BADGE}
            badgeContent={index + 1}
          >
            <ProblemMarkdown content={hint} />
          </DisclosurePanel>
        ))}
      </div>
    </CompetitionProblemSurface>
  )
}
