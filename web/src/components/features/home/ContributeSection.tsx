import { Code, FileText, Globe, Shield } from 'lucide-react'
import { useTranslations } from 'next-intl'

import ContactButton from '@/components/features/contact/ContactButton'
import Badge from '@/components/features/home/layout/Badge'
import { AppLink } from '@/components/shared/components/AppLink'
import Section from '@/components/shared/components/Section'

/**
 * Displays the contribute/open-source section on the home page.
 */
export const ContributeSection = () => {
  // Translations for section
  const t = useTranslations('home.contribute')

  // The cards to display in the section
  const contributeCards = [
    {
      iconComponent: Globe,
      title: t('feedback.title'),
      description: t.rich('feedback.text', {
        link: (chunks) => (
          <ContactButton reason="feedback" className="text-indigo-400 font-medium hover:underline">
            {chunks}
          </ContactButton>
        ),
      }),
    },
    {
      iconComponent: Code,
      title: t('development.title'),
      description: t.rich('development.text', {
        link: (chunks) => (
          <AppLink
            href="https://github.com/PatrikBak/MathComps"
            className="text-indigo-400 font-medium hover:underline"
          >
            {chunks}
          </AppLink>
        ),
      }),
    },
    {
      iconComponent: FileText,
      title: t('content.title'),
      description: t.rich('content.text', {
        link: (chunks) => (
          <ContactButton
            reason="contentContribution"
            className="text-indigo-400 font-medium hover:underline"
          >
            {chunks}
          </ContactButton>
        ),
      }),
    },
  ]

  return (
    <Section
      id="contribute-section"
      badge={
        <Badge
          icon={<Shield size={14} className="sm:w-4 sm:h-4" />}
          text={t('badge')}
          color="green"
        />
      }
      title={t('title')}
      description={t('description')}
      cards={contributeCards}
    />
  )
}
