import type { Metadata } from 'next'

import type { HandoutSection } from '@/components/features/handouts/handout-metadata-types'
import {
  isPublicHandout,
  isReadyHandout,
} from '@/components/features/handouts/handout-metadata-types'
import { HandoutSectionList } from '@/components/features/handouts/HandoutSectionList'
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
    namespace: 'metadata.handouts',
    path: ROUTES.HANDOUTS,
    useSection: true,
  })
}

/**
 * Page component.
 */
export default withLocale(async function HandoutsPage({ locale }: PageProps) {
  // Load the handout data JSON
  const sections = handoutIndex as unknown as HandoutSection[]

  // Check for duplicate ids (only for ready handouts that have ids)
  validateUniqueIds(
    sections.flatMap((section) => section.handouts).filter(isReadyHandout),
    (handout) => handout.id,
    'handout'
  )

  // Filter out non-public handouts and drop sections that become empty
  const publicSections = sections
    .map((section) => ({
      ...section,
      handouts: section.handouts.filter(
        (handout) => !isReadyHandout(handout) || isPublicHandout(handout)
      ),
    }))
    .filter((section) => section.handouts.length > 0)

  // Render the page with filtered handout data
  return (
    <Layout>
      <HandoutsHero />
      <HandoutSectionList sections={publicSections} locale={locale} />
    </Layout>
  )
})
