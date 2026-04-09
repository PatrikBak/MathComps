import { List } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideSection } from './layout/GuideSection'
import MathOlympiadSection from './MathOlympiadSection'
import OtherCompetitionsSection from './OtherCompetitionsSection'
import SeminarsSection from './SeminarsSection'

/**
 * Props for the {@link CompetitionsListSection} component.
 */
type CompetitionsListSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Parent guide section that groups all competition subsections:
 * Math Olympiad, Seminars, and Other Competitions.
 */
export default function CompetitionsListSection({ sectionNumberer }: CompetitionsListSectionProps) {
  // Get guide translations
  const t = useTranslations('guide')

  return (
    <GuideSection
      title={t(`titles.${GUIDE_TITLES.COMPETITIONS}`)}
      description={t('sections.competitions.description')}
      icon={{ type: 'lucide', icon: List }}
      accent="blue"
      sectionNumberer={sectionNumberer}
    >
      {/* Nested subsections */}
      <MathOlympiadSection sectionNumberer={sectionNumberer} />
      <SeminarsSection sectionNumberer={sectionNumberer} />
      <OtherCompetitionsSection sectionNumberer={sectionNumberer} />
    </GuideSection>
  )
}
