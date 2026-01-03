import type { Metadata } from 'next'

import type { HandoutSection } from '@/components/features/handouts/handout-types'
import { HandoutSectionList } from '@/components/features/handouts/HandoutSectionList'
import { HandoutsHero } from '@/components/features/handouts/HandoutsHero'
import Layout from '@/components/layout/Layout'
import { ROUTES } from '@/constants/routes'
import handoutData from '@/content/handouts/handouts.json'
import { generatePageMetadata } from '@/lib/metadata'
import { validateUniqueIds } from '@/lib/validation'

export const metadata: Metadata = generatePageMetadata({
  title: 'Materiály',
  description:
    'Priebežne pripravované texty, ktoré majú za cieľ pokryť kľúčové témy súťažnej matematiky.',
  path: ROUTES.HANDOUTS,
  type: 'website',
  section: 'Materiály',
})

export default function HandoutsPage() {
  // Load the handout data JSON
  const sections = handoutData as HandoutSection[]

  // Check for duplicate ids
  validateUniqueIds(
    sections.flatMap((section) => section.handouts),
    (handout) => handout.id,
    'handout'
  )

  return (
    <Layout>
      <HandoutsHero />
      <HandoutSectionList sections={sections} />
    </Layout>
  )
}
