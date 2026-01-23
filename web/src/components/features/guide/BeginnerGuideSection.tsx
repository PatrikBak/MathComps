import { Dumbbell, Play, Target } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { IconBadge } from './layout/IconBadge'

export default function BeginnerGuideSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const t = useTranslations('guide')

  const beginningsPoints = t.raw('sections.howToStart.steps.beginnings.points') as string[]
  const trainingPoints = t.raw('sections.howToStart.steps.training.points') as string[]

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
      iconColor="text-violet-400"
      iconBackground="bg-violet-500/10"
      sectionNumberer={sectionNumberer}
    >
      {/* Steps - Compact boxes */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        {steps.map((step, index) => {
          const StepIcon = step.icon
          const iconColors = [
            { color: 'text-sky-400', bg: 'bg-sky-500/10' },
            { color: 'text-rose-400', bg: 'bg-rose-500/10' },
          ]
          const iconScheme = iconColors[index % iconColors.length]

          return (
            <div key={index} className={GUIDE_STYLES.card}>
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4 -ml-1">
                <IconBadge
                  icon={StepIcon}
                  color={iconScheme.color}
                  background={iconScheme.bg}
                  size={16}
                />
                <div className="flex-1">
                  <h4 className={GUIDE_STYLES.cardTitle}>{step.title}</h4>
                </div>
              </div>
              {step.points && (
                <BulletList
                  items={step.points}
                  bulletStyle={step.bulletStyle as 'checkbox' | 'circle'}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Final Note - Simple info box */}
      <div className="mt-6 sm:mt-8">
        <div className={GUIDE_STYLES.noteBox}>
          <h4 className="text-lg sm:text-xl font-semibold text-emerald-300 mb-2 sm:mb-3">
            {t('sections.howToStart.finalNote.title')}
          </h4>
          <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>
            {t('sections.howToStart.finalNote.text')}
          </p>
        </div>
      </div>
    </GuideSection>
  )
}
