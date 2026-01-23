import type { Metadata } from 'next'

import { ContributeSection } from '@/components/features/home/ContributeSection'
import FeatureHighlights from '@/components/features/home/FeatureHighlightsSection'
import HeroSection from '@/components/features/home/HeroSection'
import SponsorshipSection from '@/components/features/home/SponsorshipSection'
import VisionSection from '@/components/features/home/VisionSection'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { withLocale } from '@/i18n/with-locale'
import { createPageMetadata } from '@/lib/metadata'

/**
 * Page metadata.
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
    namespace: 'metadata.home',
    path: ROUTES.HOME,
  })
}

/**
 * Page component.
 */
export default withLocale(async function Home() {
  return (
    <Layout>
      <HeroSection />
      <FeatureHighlights />
      <VisionSection />
      <ContributeSection />
      <SponsorshipSection />
    </Layout>
  )
})
