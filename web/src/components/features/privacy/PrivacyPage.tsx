import { useTranslations } from 'next-intl'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'

export default function PrivacyPage() {
  // Get the translations
  const t = useTranslations('privacy')

  // Generic contact email
  const contactEmail = getRequiredEnv('NEXT_PUBLIC_CONTACT_EMAIL')

  return (
    <div>
      {/* Page title */}
      <h1 className="text-3xl sm:text-4xl font-bold mb-8 text-foreground">{t('title')}</h1>

      {/* Last updated date */}
      <p className="text-muted mb-8 italic">{t('lastUpdated')}</p>

      {/* Main content */}
      <div className="space-y-8 text-muted-foreground leading-relaxed [&_section]:space-y-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_a]:text-link [&_a]:hover:text-link-hover [&_a]:hover:underline [&_a]:transition-colors [&_a]:duration-300">
        {/* Section 1: Intro & Age */}
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

        {/* Section 2: Data Collection */}
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
        </section>

        {/* Section 3: Cookies & Storage */}
        <section>
          <h2>{t('sections.cookies.title')}</h2>
          <p>{t('sections.cookies.text')}</p>
        </section>

        {/* Section 4: Deletion */}
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
