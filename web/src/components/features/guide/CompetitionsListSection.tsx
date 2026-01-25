import { List } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideSection } from './layout/GuideSection'
import MathOlympiadSection from './MathOlympiadSection'
import OtherCompetitionsSection from './OtherCompetitionsSection'
import SeminarsSection from './SeminarsSection'

export default function CompetitionsListSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  // Get guide translations
  const t = useTranslations('guide')

  return (
    <GuideSection
      title={t(`titles.${GUIDE_TITLES.COMPETITIONS}`)}
      description={t('sections.competitions.description')}
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
