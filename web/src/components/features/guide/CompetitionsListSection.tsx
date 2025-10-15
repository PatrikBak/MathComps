import { List } from 'lucide-react'
import React from 'react'

import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_SECTION_IDS } from './layout/guide-structure'
import { GuideSection } from './layout/GuideSection'
import MathOlympiadSection from './MathOlympiadSection'
import OtherCompetitionsSection from './OtherCompetitionsSection'
import SeminarsSection from './SeminarsSection'

export default function CompetitionsListSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  return (
    <GuideSection
      id={GUIDE_SECTION_IDS.COMPETITIONS}
      description="Najvýznamnejšia súťaž je Matematická olympiáda (MO). Je však kopa ďalších súťaží a aktivít, ktoré sú dobré ako tréning pre MO alebo aj samé osebe 😇."
      icon={{ type: 'lucide', icon: List }}
      iconColor="text-blue-400"
      iconBackground="bg-blue-500/10"
      sectionNumberer={sectionNumberer}
    >
      {/* Nested subsections */}
      <MathOlympiadSection sectionNumberer={sectionNumberer} />
      <SeminarsSection sectionNumberer={sectionNumberer} />
      <OtherCompetitionsSection sectionNumberer={sectionNumberer} />
    </GuideSection>
  )
}
