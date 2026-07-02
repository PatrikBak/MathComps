import type { Metadata } from 'next'
import { Suspense } from 'react'

import { renderGuideRichDescriptions } from '@/components/features/guide/components/guide-rich-description'
import { GuideDeck } from '@/components/features/guide/components/GuideDeck'
import { GuideRouteProvider } from '@/components/features/guide/components/GuideRouteProvider'
import { GUIDE_CONTENT } from '@/components/features/guide/content/guide-content'
import { decodeDeckState } from '@/components/features/guide/content/guide-url'
import Layout from '@/components/layout/Layout'
import { toUrlSearchParams } from '@/components/shared/utils/url-utils'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { type PageProps, withLocale } from '@/i18n/with-locale'
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
    useSection: true,
  })
}

/**
 * Props for the {@link GuideDeckSection} segment.
 */
type GuideDeckSectionProps = {
  /** The active locale. */
  locale: Locale
  /** The request query. */
  searchParams: PageProps['searchParams']
}

/**
 * Decodes the deck's initial view from the request query and renders the deck. Kept as a nested async
 * segment behind the page's Suspense boundary: reading `searchParams` streams the deck as a
 * per-request dynamic hole (so every page's content lands in crawlable HTML) while the shell around it
 * stays static.
 */
async function GuideDeckSection({ locale, searchParams }: GuideDeckSectionProps) {
  // Read the request query as URLSearchParams, server-side
  const query = toUrlSearchParams((await searchParams) ?? {})
  // Decode the deck's initial view: active page + its filters
  const initialState = decodeDeckState(query, locale)

  // Pre-render the rich descriptions for the active locale
  const richDescriptions = renderGuideRichDescriptions(GUIDE_CONTENT, locale)

  // Hand the initial view + descriptions to the client deck
  return <GuideDeck initialState={initialState} richDescriptions={richDescriptions} />
}

/**
 * The guide page renders the interactive deck. Its initial view is decoded from the query
 * server-side, so all six pages render into crawlable HTML.
 */
export default withLocale(async function GuidePage({ locale, searchParams }: PageProps) {
  // Render the deck shell. The route provider wraps the layout so the navbar's language switcher can
  // re-encode the deck's URL state; the deck itself decodes the query behind the Suspense boundary.
  return (
    <GuideRouteProvider>
      <Layout>
        <Suspense fallback={null}>
          <GuideDeckSection locale={locale} searchParams={searchParams} />
        </Suspense>
      </Layout>
    </GuideRouteProvider>
  )
})
