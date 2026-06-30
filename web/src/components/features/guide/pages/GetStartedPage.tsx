import { Dumbbell, Rocket } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import type { Locale } from '@/i18n/i18n'

import { GUIDE_CONTENT } from '../content/guide-content'
import { BulletList } from '../layout/BulletList'
import { IconAccentCard, type IconAccentMeta } from '../layout/IconAccentCard'
import TipBox from '../layout/TipBox'
import { PageHeader } from './DeckPrimitives'

/** Icon + accent per step id. */
const STEP_META: Record<string, IconAccentMeta> = {
  beginnings: { icon: Rocket, accent: 'emerald' },
  training: { icon: Dumbbell, accent: 'amber' },
}

/**
 * Deck page: how to start and keep going — the step cards and the closing note.
 */
export function GetStartedPage() {
  // Active locale
  const locale = useLocale() as Locale
  // The guide translation namespace
  const tGuide = useTranslations('guide')

  // The header, the step cards, and the closing note
  return (
    <div>
      <PageHeader
        title={tGuide('titles.howToStart')}
        description={tGuide('sections.howToStart.description')}
      />

      {/* Step cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GUIDE_CONTENT.steps.map((step) => {
          // Resolve the per-step icon + accent
          const meta = STEP_META[step.id]

          // The step card
          return (
            <IconAccentCard
              key={step.id}
              id={step.id}
              meta={meta}
              iconSize={16}
              title={step.title[locale]}
            >
              <BulletList items={step.points.map((point) => point[locale])} />
            </IconAccentCard>
          )
        })}
      </div>

      {/* Closing note */}
      <TipBox variant="brand" label={tGuide('sections.howToStart.finalNote.title')}>
        {tGuide('sections.howToStart.finalNote.text')}
      </TipBox>
    </div>
  )
}
