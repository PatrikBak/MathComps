import { FileText, GitBranch, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'

import GradientText from '@/components/shared/components/GradientText'
import Section from '@/components/shared/components/Section'
import { ROUTES } from '@/i18n/i18n'

/**
 * Displays the main feature highlights section on the home page.
 */
export default function FeatureHighlights() {
  // Translations for section
  const t = useTranslations('home.highlights')

  // The cards to display in the section
  const features = [
    {
      iconComponent: Search,
      title: t('archive.title'),
      description: t('archive.description'),
      href: ROUTES.PROBLEMS,
    },
    {
      iconComponent: FileText,
      title: t('handouts.title'),
      description: t('handouts.description'),
      href: ROUTES.HANDOUTS,
    },
    {
      iconComponent: GitBranch,
      title: t('guide.title'),
      description: t('guide.description'),
      href: ROUTES.GUIDE,
    },
  ]

  return (
    <Section
      title={
        <>
          {t('title')} <GradientText className="block">{t('titleGradient')}</GradientText>
        </>
      }
      cards={features}
    />
  )
}
