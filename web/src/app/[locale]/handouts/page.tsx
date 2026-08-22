import type { Metadata } from 'next'

import type { HandoutIndex } from '@/components/features/handouts/handout-metadata-types'
import {
  isPublicHandout,
  supportsLocale,
} from '@/components/features/handouts/handout-metadata-types'
import { HandoutBrowser } from '@/components/features/handouts/HandoutBrowser'
import { HandoutsHero } from '@/components/features/handouts/HandoutsHero'
import Layout from '@/components/layout/Layout'
import handoutIndex from '@/content/handouts.json'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { type PageProps, withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'
import { validateUniqueIds } from '@/lib/validation'

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
    namespace: 'pages.handouts',
    path: ROUTES.HANDOUTS,
    useSection: true,
  })
}

/**
 * Page component.
 */
export default withLocale(async function HandoutsPage({ locale }: PageProps) {
  // Load the handout data JSON
  const { sections } = handoutIndex as unknown as HandoutIndex

  // Check for duplicate ids
  validateUniqueIds(
    sections.flatMap((section) => section.handouts),
    (handout) => handout.id,
    'handout'
  )

  // Filter out handouts that don't support the current locale or are non-public
  const publicSections = sections
    .map((section) => ({
      ...section,
      handouts: section.handouts.filter(
        (handout) => supportsLocale(handout, locale) && isPublicHandout(handout)
      ),
    }))
    .filter((section) => section.handouts.length > 0)

  // Render the page with filtered handout data
  return (
    <Layout>
      {/* The intro over the topic sections */}
      <div className="mx-auto max-w-4xl">
        <HandoutsHero />
        <HandoutBrowser sections={publicSections} locale={locale} />
      </div>
    </Layout>
  )
})
