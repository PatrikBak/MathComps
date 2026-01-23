import type { Metadata } from 'next'

import { AuthorSection } from '@/components/features/about/AuthorSection'
import { HeroSection } from '@/components/features/about/HeroSection'
import { RoadmapSection } from '@/components/features/about/RoadmapSection'
import { StorySection } from '@/components/features/about/StorySection'
import TechnologiesSection from '@/components/features/about/TechnologiesSection'
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
  const { locale } = await params
  return createPageMetadata({
    locale: locale as Locale,
    namespace: 'metadata.about',
    path: ROUTES.ABOUT,
    useSection: true,
  })
}

/**
 * Page component.
 */
export default withLocale(async function AboutPage() {
  return (
    <Layout>
      <HeroSection />
      <StorySection />
      <AuthorSection />
      <RoadmapSection />
      <TechnologiesSection />
    </Layout>
  )
})
