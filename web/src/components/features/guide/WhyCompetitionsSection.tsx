import { Brain, Briefcase, Sparkles, Trophy, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { IconBadge } from '@/components/shared/components/IconBadge'
import type { AccentColor } from '@/components/shared/utils/accent-colors'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideCard } from './layout/GuideCard'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'

/**
 * Props for the {@link WhyCompetitionsSection} component.
 */
type WhyCompetitionsSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Guide section explaining the benefits of participating in math competitions.
 * Renders a grid of benefit cards with icons and descriptions.
 */
export default function WhyCompetitionsSection({ sectionNumberer }: WhyCompetitionsSectionProps) {
  // Common guide translations
  const guide = useTranslations('guide')

  // Scoped translator for benefits
  const tBenefits = useTranslations('guide.sections.whyCompetitions.benefits')

  // The displayed benefits
  const benefits = [
    {
      title: tBenefits('potential.title'),
      icon: Sparkles,
      accent: 'sky' as AccentColor,
      description: tBenefits('potential.text'),
    },
    {
      icon: Brain,
      accent: 'blue' as AccentColor,
      title: tBenefits('logic.title'),
      description: tBenefits('logic.text'),
    },
    {
      title: tBenefits('community.title'),
      icon: Users,
      accent: 'purple' as AccentColor,
      description: tBenefits('community.text'),
    },
    {
      icon: Briefcase,
      accent: 'emerald' as AccentColor,
      title: tBenefits('career.title'),
      description: tBenefits('career.text'),
    },
  ]

  return (
    <GuideSection
      title={guide(`titles.${GUIDE_TITLES.WHY_COMPETITIONS}`)}
      description={guide('sections.whyCompetitions.description')}
      icon={{ type: 'lucide', icon: Trophy }}
      accent="amber"
      sectionNumberer={sectionNumberer}
    >
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {benefits.map((benefit, index) => {
          const Icon = benefit.icon
          return (
            <GuideCard key={index} className="flex items-start gap-3 sm:gap-4">
              <IconBadge icon={Icon} accent={benefit.accent} />
              <div className="flex-1 min-w-0">
                <GuideHeading level="h4">{benefit.title}</GuideHeading>
                <GuideText variant="small" color="muted">
                  {benefit.description}
                </GuideText>
              </div>
            </GuideCard>
          )
        })}
      </div>
    </GuideSection>
  )
}
