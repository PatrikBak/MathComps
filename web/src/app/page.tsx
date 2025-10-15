import type { Metadata } from 'next'

import { ContributeSection } from '@/components/features/home/ContributeSection'
import FeatureHighlights from '@/components/features/home/FeatureHighlightsSection'
import HeroSection from '@/components/features/home/HeroSection'
import SponsorshipSection from '@/components/features/home/SponsorshipSection'
import VisionSection from '@/components/features/home/VisionSection'
import Layout from '@/components/layout/Layout'

export const metadata: Metadata = { title: 'Mathcomps' }

export default function Home() {
  return (
    <Layout>
      <HeroSection />
      <FeatureHighlights />
      <VisionSection />
      <ContributeSection />
      <SponsorshipSection />
    </Layout>
  )
}
