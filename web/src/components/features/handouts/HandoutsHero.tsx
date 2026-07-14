import { useTranslations } from 'next-intl'

import ContactButton from '@/components/features/contact/ContactButton'
import { AppLink } from '@/components/shared/components/AppLink'
import { PageHeader } from '@/components/shared/components/PageHeader'
import { MATIKA_CESKU_URL } from '@/constants/links'

/**
 * The header of the handouts list page: the title over an intro and a feedback invite.
 */
export function HandoutsHero() {
  // Handouts hero translations
  const t = useTranslations('handouts.hero')

  // Title over the intro paragraphs
  return (
    <PageHeader title={t('title')}>
      {/* Intro paragraph */}
      <p>
        {t.rich('body1', {
          // Link out to the circles' enrollment page
          link: (chunks) => (
            <AppLink
              href={MATIKA_CESKU_URL}
              external
              newTab
              className="text-link hover:text-link-hover"
            >
              {chunks}
            </AppLink>
          ),
        })}
      </p>

      {/* Feedback invite */}
      <p>
        {t.rich('outro', {
          // Link that opens the contact modal
          feedback: (chunks) => (
            <ContactButton reason="feedback" className="text-link hover:text-link-hover">
              {chunks}
            </ContactButton>
          ),
        })}
      </p>
    </PageHeader>
  )
}
