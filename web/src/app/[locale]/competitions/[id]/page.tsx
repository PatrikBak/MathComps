import type { Metadata } from 'next'

import { CompetitionArea } from '@/components/features/hosted-competitions/components/CompetitionArea'
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
  params: Promise<{ locale: string; id: string }>
}): Promise<Metadata> {
  // Resolve the locale and which competition this is from the path
  const { locale, id } = await params

  // Generate locale-specific metadata
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'pages.competitionArea',
    path: ROUTES.COMPETITION_AREA,
    routeParams: { id },
    noindex: true,
  })
}

/**
 * One competition's own area: its problems, the entrant's clock, and the defenses they hold about each.
 */
export default withLocale(async function CompetitionAreaPage({
  params,
}: PageProps<{ id: string }>) {
  // Which competition the reader is inside
  const { id } = await params

  // Render the area
  return (
    <Layout>
      <CompetitionArea competitionId={id} />
    </Layout>
  )
})
