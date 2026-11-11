import type { Metadata } from 'next'

import { PhotoHandoffPage } from '@/components/features/defense/components/PhotoHandoffPage'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. It is kept out of search entirely, since it is only ever opened from a QR carrying a
 * student's handoff code.
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
    namespace: 'pages.photoHandoff',
    path: ROUTES.PHOTO_HANDOFF,
    noindex: true,
  })
}

/**
 * The page a phone opens from a computer's QR to send photos of handwritten work into a conversation with Mathilda.
 */
export default withLocale(async function PhotoHandoffRoute() {
  // The phone's page in the site's frame
  return (
    <Layout displayFooter={false}>
      <PhotoHandoffPage />
    </Layout>
  )
})
