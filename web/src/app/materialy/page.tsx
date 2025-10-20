import type { Metadata } from 'next'

import { HandoutSectionList } from '@/components/features/handouts/HandoutSectionList'
import { HandoutsHero } from '@/components/features/handouts/HandoutsHero'
import type { HandoutSection } from '@/components/features/handouts/types/handout-types'
import Layout from '@/components/layout/Layout'
import { PAGE_LAYOUT } from '@/constants/common-section-styles'
import { ROUTES } from '@/constants/routes'
import handoutData from '@/content/handouts/handouts.json'
import { generatePageMetadata } from '@/lib/metadata'

export const metadata: Metadata = generatePageMetadata({
  title: 'Materiály',
  description:
    'Priebežne pripravované texty, ktoré majú za cieľ pokryť kľúčové témy súťažnej matematiky.',
  path: ROUTES.HANDOUTS,
  type: 'website',
  section: 'Materiály',
})

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
