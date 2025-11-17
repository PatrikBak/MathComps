import type { Metadata } from 'next'

import { AuthorSection } from '@/components/features/about/AuthorSection'
import { HeroSection } from '@/components/features/about/HeroSection'
import { RoadmapSection } from '@/components/features/about/RoadmapSection'
import { StorySection } from '@/components/features/about/StorySection'
import TechnologiesSection from '@/components/features/about/TechnologiesSection'
import Layout from '@/components/layout/Layout'
import { ROUTES } from '@/constants/routes'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'O projekte',
  description: 'Zistite viac o projekte MathComps, jeho príbehu, autorovi a technológiách.',
  path: ROUTES.ABOUT,
  type: 'website',
  section: 'O projekte',
})

export default function AboutPage() {
  return (
    <Layout>
      <HeroSection />
      <StorySection />
      <AuthorSection />
      <RoadmapSection />
      <TechnologiesSection />
    </Layout>
  )
}
