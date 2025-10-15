import type { Metadata } from 'next'

import { HandoutSectionList } from '@/components/features/handouts/HandoutSectionList'
import { HandoutsHero } from '@/components/features/handouts/HandoutsHero'
import type { HandoutSection } from '@/components/features/handouts/types/handout-types'
import Layout from '@/components/layout/Layout'
import { PAGE_LAYOUT } from '@/constants/common-section-styles'
import handoutData from '@/content/handouts/handouts.json'

export const metadata: Metadata = { title: 'Materiály' }

export default function HandoutsPage() {
  const sections = handoutData as HandoutSection[]

  return (
    <Layout>
      <div className={PAGE_LAYOUT.headerSpacing} />
      <div
        className={`${PAGE_LAYOUT.maxWidth} ${PAGE_LAYOUT.bottomMargin} ${PAGE_LAYOUT.padding} mx-auto`}
      >
        <HandoutsHero />
        <HandoutSectionList sections={sections} />
      </div>
    </Layout>
  )
}
