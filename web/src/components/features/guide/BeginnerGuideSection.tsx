import { Dumbbell, Play, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { IconBadge } from '@/components/shared/components/IconBadge'
import type { AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { COMPLETION_ACCENT } from './guide-colors'
import { BulletList } from './layout/BulletList'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideCard } from './layout/GuideCard'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'

/**
 * Props for the {@link BeginnerGuideSection} component.
 */
type BeginnerGuideSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Guide section that introduces beginners to math competitions.
 * Contains step-by-step cards with checkboxes and bullet points.
 */
export default function BeginnerGuideSection({ sectionNumberer }: BeginnerGuideSectionProps) {
  // Guide translations
  const t = useTranslations('guide')

  // Raw point arrays for each step's bullet list
  const beginningsPoints = t.raw('sections.howToStart.steps.beginnings.points') as string[]
  const trainingPoints = t.raw('sections.howToStart.steps.training.points') as string[]

  // Step definitions with icons, titles, and bullet styles
  const steps = [
    {
      icon: Play,
      title: t('sections.howToStart.steps.beginnings.title'),
      points: beginningsPoints,
      bulletStyle: 'checkbox',
    },
    {
      icon: Dumbbell,
      title: t('sections.howToStart.steps.training.title'),
      points: trainingPoints,
      bulletStyle: 'circle',
    },
  ]

  return (
    <GuideSection
      title={t(`titles.${GUIDE_TITLES.HOW_TO_START}`)}
      description={t('sections.howToStart.description')}
      icon={{ type: 'lucide', icon: Target }}
      accent="purple"
      sectionNumberer={sectionNumberer}
    >
      {/* Steps - Compact boxes */}
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {steps.map((step, index) => {
          // Resolve icon and alternating accent color
          const StepIcon = step.icon
          const iconAccents: AccentColor[] = ['sky', 'rose']
          const stepAccent = iconAccents[index % iconAccents.length]

          return (
            <GuideCard key={index}>
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 -ml-1">
                <IconBadge icon={StepIcon} accent={stepAccent} size={16} />
                <div className="flex-1">
                  <GuideHeading level="h3">{step.title}</GuideHeading>
                </div>
              </div>
              {step.points && (
                <BulletList
                  items={step.points}
                  bulletStyle={step.bulletStyle as 'checkbox' | 'circle'}
                />
              )}
            </GuideCard>
          )
        })}
      </div>

      {/* Final Note - Simple info box */}
      <div className="mt-6 sm:mt-8">
        <GuideCard variant="completion">
          <GuideHeading level="h3" className={cn('mb-2 sm:mb-3', COMPLETION_ACCENT.icon)}>
            {t('sections.howToStart.finalNote.title')}
          </GuideHeading>
          <GuideText>{t('sections.howToStart.finalNote.text')}</GuideText>
        </GuideCard>
      </div>
    </GuideSection>
  )
}
