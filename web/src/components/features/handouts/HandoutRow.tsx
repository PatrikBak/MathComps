import { User } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { MathRendererClient } from '@/components/math/MathRendererClient'
import { AppLink } from '@/components/shared/components/AppLink'
import { type Locale, ROUTES } from '@/i18n/i18n'

import { joinAuthors } from '../../shared/utils/string-utils'
import { DifficultyMeter } from './DifficultyMeter'
import { HANDOUT_DIFFICULTY_LEVELS, type HandoutMetadata } from './handout-metadata-types'

/**
 * Props for the {@link HandoutRow} component.
 */
type HandoutRowProps = {
  /** The handout to display */
  handout: HandoutMetadata
  /** Current locale */
  locale: Locale
}

/**
 * One handout as a card: the title with its difficulty meter, over the author. The whole card links
 * to the detail page, lifts on hover and the title warms to the accent.
 */
export function HandoutRow({ handout, locale }: HandoutRowProps) {
  // Row aria translations
  const tAria = useTranslations('handouts.aria')

  // The localized title
  const title = handout.title[locale]
  // The detail-route slug
  const slug = handout.slug[locale]

  return (
    <AppLink
      href={`${ROUTES.HANDOUTS}/${slug}`}
      plain
      className="group block rounded-lg bg-surface/40 px-4 py-3.5 transition-colors hover:bg-surface/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
      aria-label={tAria('openHandout', { title })}
    >
      {/* Title beside its difficulty meter */}
      <div className="flex items-center justify-between gap-3">
        {/* Title, warming to the accent on hover */}
        <span className="min-w-0 truncate text-lg font-semibold leading-snug text-foreground transition-colors group-hover:text-brand-light motion-reduce:transition-none sm:text-xl">
          <MathRendererClient content={title} />
        </span>

        {/* Difficulty meter */}
        <DifficultyMeter
          level={handout.difficulty}
          srLabel={tAria('difficulty', {
            level: handout.difficulty,
            max: HANDOUT_DIFFICULTY_LEVELS.length,
          })}
        />
      </div>

      {/* Author byline */}
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <User className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span className="truncate">{joinAuthors(handout.authors, 2)}</span>
      </p>
    </AppLink>
  )
}
