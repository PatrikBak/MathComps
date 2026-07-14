import { useTranslations } from 'next-intl'

import { PageHeader } from '@/components/shared/components/PageHeader'
import { getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * The privacy-policy page.
 */
export default function PrivacyPage() {
  // Get the translations
  const t = useTranslations('privacy')

  // Generic contact email
  const contactEmail = getRequiredEnv('NEXT_PUBLIC_CONTACT_EMAIL')

  return (
    <div>
      {/* Page header */}
      <PageHeader title={t('title')} />

      {/* Last updated date */}
      <p className="text-muted mb-8 italic">{t('lastUpdated')}</p>

      {/* Main content */}
      <div className="space-y-8 text-muted-foreground leading-relaxed hyphens-none [&_section]:space-y-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:text-link [&_a]:hover:text-link-hover [&_a]:hover:underline [&_a]:transition-colors [&_a]:duration-300">
        {/* Intro & age */}
        <section>
          <h2>{t('sections.intro.title')}</h2>
          <p>
            {t.rich('sections.intro.operator', {
              email: () => <a href={`mailto:${contactEmail}`}>{contactEmail}</a>,
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <p>{t('sections.intro.ageRequirement')}</p>
        </section>

        {/* Data collection */}
        <section>
          <h2>{t('sections.data.title')}</h2>
          <p>{t('sections.data.intro')}</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              {t.rich('sections.data.login', { strong: (chunks) => <strong>{chunks}</strong> })}
            </li>
            <li>
              {t.rich('sections.data.content', { strong: (chunks) => <strong>{chunks}</strong> })}
            </li>
          </ul>
          <p>
            {t.rich('sections.data.processor', {
              link: (chunks) => (
                <a href="https://clerk.com" target="_blank" rel="noopener noreferrer">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </section>

        {/* Cookies & storage */}
        <section>
          <h2>{t('sections.cookies.title')}</h2>
          <p>{t('sections.cookies.text')}</p>
        </section>

        {/* Deletion */}
        <section>
          <h2>{t('sections.deletion.title')}</h2>
          <p>
            {t.rich('sections.deletion.text', {
              email: () => <a href={`mailto:${contactEmail}`}>{contactEmail}</a>,
            })}
          </p>
        </section>
      </div>
    </div>
  )
}
