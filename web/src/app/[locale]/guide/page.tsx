import type { Metadata } from 'next'
import { Suspense } from 'react'

import { renderGuideRichDescriptions } from '@/components/features/guide/components/guide-rich-description'
import { GuideDeck } from '@/components/features/guide/components/GuideDeck'
import { GuideRouteProvider } from '@/components/features/guide/components/GuideRouteProvider'
import { GUIDE_CONTENT } from '@/components/features/guide/content/guide-content'
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
 * The guide page renders the interactive deck. The deck is a client component reading URL state,
 * so it sits behind a Suspense boundary (required for `useSearchParams`).
 */
export default withLocale(async function GuidePage({ locale }: { locale: Locale }) {
  // Pre-render the rich descriptions for the active locale
  const richDescriptions = renderGuideRichDescriptions(GUIDE_CONTENT, locale)

  // Render the deck shell, handing the pre-rendered descriptions to the client deck. The route
  // provider wraps the layout so the navbar's language switcher can re-encode the deck's URL state.
  return (
    <GuideRouteProvider>
      <Layout>
        <Suspense fallback={null}>
          <GuideDeck richDescriptions={richDescriptions} />
        </Suspense>
      </Layout>
    </GuideRouteProvider>
  )
})
