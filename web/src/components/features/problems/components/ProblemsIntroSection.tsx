import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/i18n'

/**
 * Props for the {@link ProblemsIntroSection} component.
 */
type ProblemsIntroSectionProps = {
  /** The target locale. */
  locale: Locale
}

/**
 * A visually-hidden landmark heading for the problems archive: an `<h1>` and description in the SSR
 * HTML and the accessibility tree. Kept `sr-only` because the archive app below is a fixed
 * full-viewport overlay and the page carries no other `<h1>`.
 */
export async function ProblemsIntroSection({ locale }: ProblemsIntroSectionProps) {
  // Reuse the page's own localized title + description
  const t = await getTranslations({ locale, namespace: 'pages.problems' })

  // Emit the sr-only heading + description
  return (
    <section className="sr-only">
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </section>
  )
}
