import { useTranslations } from 'next-intl'

import { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import BeginnerGuideSection from './BeginnerGuideSection'
import CompetitionsListSection from './CompetitionsListSection'
import { getGuideTableOfContents } from './layout/guide-structure'
import ResourcesSection from './ResourcesSection'
import WhyCompetitionsSection from './WhyCompetitionsSection'

export default function GuideDetail() {
  // Get guide translations
  const tGuide = useTranslations('guide')
  const tTitles = useTranslations('guide.titles')

  // Generate TOC items and create a numberer for section lookups
  const tocItems = getGuideTableOfContents(tTitles)
  const sectionNumberer = new SectionNumberer(tocItems)

  return (
    <>
      <div className="space-y-6 sm:space-y-8 md:space-y-10">
        <header>
          <div className="mb-4 sm:mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              {tGuide('hero.title')}
            </h1>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-4xl leading-relaxed">
            {tGuide('hero.description')}
          </p>
        </header>

        {/* Individual sections */}
        <WhyCompetitionsSection sectionNumberer={sectionNumberer} />
        <CompetitionsListSection sectionNumberer={sectionNumberer} />
        <ResourcesSection sectionNumberer={sectionNumberer} />
        <BeginnerGuideSection sectionNumberer={sectionNumberer} />
      </div>
    </>
  )
}
