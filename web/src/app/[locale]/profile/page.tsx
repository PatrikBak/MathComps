import type { Metadata } from 'next'

import ProfilePageContent from '@/components/features/profile/ProfilePageContent'
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
    namespace: 'pages.profile',
    path: ROUTES.PROFILE,
    useSection: true,
    noindex: true,
  })
}

/**
 * Page component, in the middle of the screen.
 */
export default withLocale(async function ProfilePage() {
  return (
    <Layout centerMidscreen>
      <ProfilePageContent />
    </Layout>
  )
})
