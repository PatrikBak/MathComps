import type { Metadata } from 'next'

import { AuthorSection } from '@/components/features/about/AuthorSection'
import { HeroSection } from '@/components/features/about/HeroSection'
import { RoadmapSection } from '@/components/features/about/RoadmapSection'
import { StorySection } from '@/components/features/about/StorySection'
import TechnologiesSection from '@/components/features/about/TechnologiesSection'
import Layout from '@/components/layout/Layout'

export const metadata: Metadata = { title: 'O projekte' }

const AboutPage = () => {
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

export default AboutPage
