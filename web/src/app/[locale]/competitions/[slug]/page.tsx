import type { Metadata } from 'next'

import { CompetitionArea } from '@/components/features/hosted-competitions/components/CompetitionArea'
import { CompetitionRouteProvider } from '@/components/features/hosted-competitions/components/CompetitionRouteProvider'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import type { PageProps } from '@/i18n/with-locale'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page-specific metadata. The problems here are embargoed until their group closes, so the page stays out of
 * search whatever else happens to it.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>
}): Promise<Metadata> {
  // Resolve the locale and which competition this is from the path
  const { locale, slug } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'pages.competitionArea',
    path: ROUTES.COMPETITION_AREA,
    routeParams: { slug },
    noindex: true,
  })
}

/**
 * One competition's own area: its problems, the entrant's clock, and the defenses they hold about each.
 */
export default withLocale(async function CompetitionAreaPage({
  params,
}: PageProps<{ slug: string }>) {
  // Which competition the reader is inside
  const { slug } = await params

  // Render the area, under the provider that keeps a language switch inside this competition
  return (
    <CompetitionRouteProvider competitionSlug={slug}>
      <Layout>
        <CompetitionArea competitionSlug={slug} />
      </Layout>
    </CompetitionRouteProvider>
  )
})
