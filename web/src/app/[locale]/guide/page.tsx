import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import GuideDetail from '@/components/features/guide/GuideDetail'
import { getGuideTableOfContents } from '@/components/features/guide/layout/guide-structure'
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
    namespace: 'metadata.guide',
    path: ROUTES.GUIDE,
    type: 'article',
    useSection: true,
  })
}

/**
 * Page component, with manually pre-typed table of contents.
 */
export default withLocale(async function GuidePage({ locale }: { locale: Locale }) {
  // Get scoped translator for guide titles
  const tTitles = await getTranslations({ locale, namespace: 'guide.titles' })

  // Get the locale-specific guide table of contents
  const tocItems = getGuideTableOfContents(tTitles)

  // Render the page
  return (
    <Layout tocItems={tocItems}>
      <GuideDetail />
    </Layout>
  )
})
