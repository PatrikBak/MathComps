import { Brain, Briefcase, Sparkles, Trophy, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { IconBadge } from './layout/IconBadge'

export default function WhyCompetitionsSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  // Common guide translations
  const guide = useTranslations('guide')

  // Scoped translator for benefits
  const tBenefits = useTranslations('guide.sections.whyCompetitions.benefits')

  // The displayed benefits
  const benefits = [
    {
      title: tBenefits('potential.title'),
      icon: Sparkles,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10',
      description: tBenefits('potential.text'),
    },
    {
      icon: Brain,
      iconColor: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      title: tBenefits('logic.title'),
      description: tBenefits('logic.text'),
    },
    {
      title: tBenefits('community.title'),
      icon: Users,
      iconColor: 'text-violet-400',
      iconBg: 'bg-violet-500/10',
      description: tBenefits('community.text'),
    },
    {
      icon: Briefcase,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      title: tBenefits('career.title'),
      description: tBenefits('career.text'),
    },
  ]

  return (
    <GuideSection
      title={guide(`titles.${GUIDE_TITLES.WHY_COMPETITIONS}`)}
      description={guide('sections.whyCompetitions.description')}
      icon={{ type: 'lucide', icon: Trophy }}
      iconColor="text-amber-400"
      iconBackground="bg-amber-500/10"
      sectionNumberer={sectionNumberer}
    >
      <div className={GUIDE_STYLES.sectionSpacing}>
        {benefits.map((benefit, index) => {
          const Icon = benefit.icon
          return (
            <div key={index} className={cn(GUIDE_STYLES.card, 'flex items-start gap-3 sm:gap-4')}>
              <IconBadge icon={Icon} color={benefit.iconColor} background={benefit.iconBg} />
              <div className="flex-1 min-w-0">
                <h3 className={GUIDE_STYLES.cardTitleSmall}>{benefit.title}</h3>
                <p className={GUIDE_STYLES.textSmall}>{benefit.description}</p>
              </div>
            </div>
          )
        })}
      </div>
    </GuideSection>
  )
}
