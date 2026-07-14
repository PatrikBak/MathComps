import type { Metadata } from 'next'

import AboutProjectSection from '@/components/features/home/AboutProjectSection'
import DestinationsSection from '@/components/features/home/DestinationsSection'
import HeroSection from '@/components/features/home/HeroSection'
import LatestNewsSection from '@/components/features/home/LatestNewsSection'
import UpcomingSection from '@/components/features/home/UpcomingSection'
import Layout from '@/components/layout/Layout'
import type { Locale } from '@/i18n/i18n'
import { ROUTES } from '@/i18n/i18n'
import { type PageProps, withLocale } from '@/i18n/with-locale'
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
export default withLocale(async function Home({ locale }: PageProps) {
  return (
    <Layout>
      <HeroSection />
      <DestinationsSection />
      <UpcomingSection />
      <LatestNewsSection locale={locale} />
      <AboutProjectSection />
    </Layout>
  )
})
