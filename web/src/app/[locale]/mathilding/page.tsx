import type { Metadata } from 'next'

import { HostedCompetitionsBoard } from '@/components/features/hosted-competitions/components/HostedCompetitionsBoard'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import type { PageProps } from '@/i18n/with-locale'
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
    namespace: 'pages.competitions',
    path: ROUTES.COMPETITIONS,
  })
}

/**
 * Every competition open right now, and the press that puts a student inside one.
 */
export default withLocale(async function CompetitionsPage({ searchParams }: PageProps) {
  // The address the reader came back to
  const query = await searchParams

  // Which competition they tried to enter before signing in, if any
  const entryIntentSlug = typeof query?.enter === 'string' ? query.enter : undefined

  // Render the board
  return (
    <Layout>
      <HostedCompetitionsBoard entryIntentSlug={entryIntentSlug} />
    </Layout>
  )
})
