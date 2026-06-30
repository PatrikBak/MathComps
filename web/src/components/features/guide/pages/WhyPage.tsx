import { Brain, Briefcase, Sprout, Users } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import type { Locale } from '@/i18n/i18n'

import { GUIDE_CONTENT } from '../content/guide-content'
import { GuideText } from '../layout/GuideText'
import { IconAccentCard, type IconAccentMeta } from '../layout/IconAccentCard'
import { PageHeader } from './DeckPrimitives'

/** Icon + accent per benefit id. */
const BENEFIT_META: Record<string, IconAccentMeta> = {
  potential: { icon: Sprout, accent: 'cyan' },
  logic: { icon: Brain, accent: 'blue' },
  community: { icon: Users, accent: 'purple' },
  career: { icon: Briefcase, accent: 'emerald' },
}

/**
 * Deck page: why do math competitions — the four benefit cards.
 */
export function WhyPage() {
  // Active locale
  const locale = useLocale() as Locale
  // The guide translation namespace
  const tGuide = useTranslations('guide')

  // The page header over the benefit-card grid
  return (
    <div>
      <PageHeader
        title={tGuide('titles.whyCompetitions')}
        description={tGuide('sections.whyCompetitions.description')}
      />
      {/* Benefit cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GUIDE_CONTENT.benefits.map((benefit) => {
          // Resolve the per-benefit icon + accent
          const meta = BENEFIT_META[benefit.id]
          // The benefit card
          return (
            <IconAccentCard
              key={benefit.id}
              id={benefit.id}
              meta={meta}
              iconSize={20}
              title={benefit.title[locale]}
            >
              <GuideText variant="small">{benefit.text[locale]}</GuideText>
            </IconAccentCard>
          )
        })}
      </div>
    </div>
  )
}
