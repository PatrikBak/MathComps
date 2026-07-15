import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/i18n'

/**
 * Gives the localized 404 its own title ("Page not found | MathComps"); the framework already marks
 * the not-found response noindex. Metadata resolves before the component throws {@link notFound}, so
 * it lands on the not-found response.
 *
 * @param params - The route params carrying the locale.
 *
 * @returns The 404 title metadata for the given locale.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Resolve the locale from the path
  const { locale } = await params

  // The not-found page's translations
  const t = await getTranslations({ locale: locale as Locale, namespace: 'notFound' })

  // Title flows through the layout template
  return {
    title: t('title'),
  }
}

/**
 * Catch-all route for handling 404s within the [locale] segment.
 * This ensures that localized not-found pages are rendered with the correct
 * layout and locale context.
 */
export default function CatchAllPage() {
  notFound()
}
