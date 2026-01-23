import type { Metadata } from 'next'

import PrivacyPage from '@/components/features/privacy/PrivacyPage'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  // Resolve the locale from the path
  const { locale } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.privacy',
    path: ROUTES.PRIVACY,
    useSection: true,
  })
}

/**
 * Page component.
 */
export default withLocale(async function PrivacyRoutePage() {
  return (
    <Layout>
      <PrivacyPage />
    </Layout>
  )
})
