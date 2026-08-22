import type { MetadataRoute } from 'next'
import { getTranslations } from 'next-intl/server'

import { SITE_NAME, SITE_THEME_COLOR } from '@/constants/og-metadata'
import { DEFAULT_LOCALE } from '@/i18n/i18n'

/**
 * Create the manifest for the PWA. Uses the default locale for description and language.
 *
 * @returns The manifest for the PWA.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // The home page's copy
  const t = await getTranslations({ locale: DEFAULT_LOCALE, namespace: 'pages.home' })

  // Generate the manifest
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: t('description'),
    start_url: '/',
    display: 'standalone',
    background_color: SITE_THEME_COLOR,
    theme_color: SITE_THEME_COLOR,
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    categories: ['education', 'utilities'],
    lang: DEFAULT_LOCALE,
    dir: 'ltr',
  }
}
