import { Brain, Sparkles, Trophy, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'

import Badge from '@/components/features/home/layout/Badge'
import Section from '@/components/shared/components/Section'

/**
 * Displays the vision/future goals section on the home page.
 */
export default function VisionSection() {
  // Translations for section
  const t = useTranslations('home.vision')

  // The cards to display in the section
  const visionItems = [
    {
      iconComponent: Users,
      title: t('community.title'),
      description: t('community.description'),
    },
    {
      iconComponent: Trophy,
      title: t('competitions.title'),
      description: t('competitions.description'),
    },
    {
      iconComponent: Brain,
      title: t('aiTools.title'),
      description: t('aiTools.description'),
    },
  ]

  return (
    <Section
      badge={
        <Badge
          icon={<Sparkles size={14} className="sm:w-4 sm:h-4" />}
          text={t('badge')}
          color="sky"
        />
      }
      title={t('title')}
      description={t('description')}
      cards={visionItems}
    />
  )
}
