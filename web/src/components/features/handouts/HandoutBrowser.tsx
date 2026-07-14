import { useTranslations } from 'next-intl'

import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import type { Locale } from '@/i18n/i18n'

import { DifficultyMeter } from './DifficultyMeter'
import { HANDOUT_DIFFICULTY_LEVELS, type HandoutSection } from './handout-metadata-types'
import { HandoutRow } from './HandoutRow'

/**
 * Props for the {@link HandoutBrowser} component.
 */
type HandoutBrowserProps = {
  /** Handout sections, each non-empty. */
  sections: HandoutSection[]
  /** Current locale */
  locale: Locale
}

/**
 * The handouts list: a difficulty key over the topic sections, stacked full-width. Each section is a
 * quiet category label over its handouts as cards that flow into a responsive grid.
 */
export function HandoutBrowser({ sections, locale }: HandoutBrowserProps) {
  // Difficulty key translations
  const tDifficulty = useTranslations('handouts.difficulty')

  // The key over the stacked sections
  return (
    <div>
      {/* Difficulty key, revealed on demand behind a help icon */}
      <div className="mb-8 flex items-center gap-1.5 text-sm font-medium text-muted-foreground sm:mb-10">
        {/* Key label */}
        <span>{tDifficulty('label')}</span>
        {/* The three levels, revealed on hover */}
        <HelpTooltip
          content={
            <ul className="space-y-1.5">
              {HANDOUT_DIFFICULTY_LEVELS.map((level) => (
                <li key={level} className="flex items-center gap-2">
                  <DifficultyMeter level={level} />
                  <span>{tDifficulty(`level${level}`)}</span>
                </li>
              ))}
            </ul>
          }
        />
      </div>

      {/* The topic sections, stacked full-width */}
      <div className="space-y-10">
        {/* One section per topic */}
        {sections.map((section) => (
          <section key={section.categoryKey}>
            {/* Category label */}
            <h2 className="mb-2 text-sm font-medium text-brand-light">
              {section.category[locale] ?? section.categoryKey}
            </h2>
            {/* The handout cards, flowing into a responsive grid */}
            <ul role="list" className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {/* One card per handout */}
              {section.handouts.map((handout) => (
                <li key={handout.id}>
                  <HandoutRow handout={handout} locale={locale} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
