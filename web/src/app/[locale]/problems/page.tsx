import type { Metadata } from 'next'
import { Suspense } from 'react'

import { ProblemsIntroSection } from '@/components/features/problems/components/ProblemsIntroSection'
import ProblemsLibrary from '@/components/features/problems/components/ProblemsLibrary'
import Layout from '@/components/layout/Layout'
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
    namespace: 'metadata.problems',
    path: ROUTES.PROBLEMS,
    useSection: true,
  })
}

/**
 * Props for the {@link LiveProblemsLibrary} segment.
 */
type LiveProblemsLibraryProps = {
  /** The request query. */
  searchParams: PageProps['searchParams']
}

/**
 * Holds the library back until the request's query exists.
 *
 * @remarks The library keeps its filters in the URL. Reading the query here is what declares that
 *   dependency, so the segment renders per request; a prerender would answer the same read with an
 *   empty query and a link carrying filters would arrive with them discarded. It sits behind the
 *   page's Suspense boundary so the header and the intro above it still reach the static shell.
 */
async function LiveProblemsLibrary({ searchParams }: LiveProblemsLibraryProps) {
  // Reading the query is the point; the library itself takes it off the URL
  await searchParams

  return <ProblemsLibrary />
}

/**
 * Page component, no footer for it takes too much precious space.
 */
export default withLocale(async function ProblemsPage({ locale, searchParams }: PageProps) {
  return (
    <Layout displayFooter={false}>
      <ProblemsIntroSection locale={locale} />
      <Suspense fallback={null}>
        <LiveProblemsLibrary searchParams={searchParams} />
      </Suspense>
    </Layout>
  )
})
