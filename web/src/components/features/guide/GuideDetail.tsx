import React from 'react'

import { MobileTableOfContents } from '@/components/table-of-contents/MobileTableOfContents'
import { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'
import { TableOfContents } from '@/components/table-of-contents/TableOfContents'
import { PAGE_LAYOUT } from '@/constants/common-section-styles'

import BeginnerGuideSection from './BeginnerGuideSection'
import CompetitionsListSection from './CompetitionsListSection'
import { guideTableOfContents } from './layout/guide-structure'
import ResourcesSection from './ResourcesSection'
import WhyCompetitionsSection from './WhyCompetitionsSection'

export default function GuideDetail() {
  // A helper type to get the section titles
  const sectionNumberer = new SectionNumberer(guideTableOfContents)

  return (
    <>
      <div className={`${PAGE_LAYOUT.padding} mt-16 sm:mt-20 pt-4 sm:pt-8 mb-4`}>
        <div
          className={`${PAGE_LAYOUT.maxWidthWide} mx-auto lg:grid lg:grid-cols-[9fr_280px] lg:gap-8`}
        >
          <div className="space-y-6 sm:space-y-8 md:space-y-10">
            <header id="guide-hero" className="pt-2 sm:pt-4">
              <div className="mb-4 sm:mb-6">
                <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
                  Rozcestník súťažnej matematiky
                </h1>
              </div>
              <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-4xl leading-relaxed">
                Zoznam súťaží a rôznych užitočných odkazov týkajúcich sa súťažnej matematiky. Plán
                je tieto sekcie priebežne dopĺňať o tie najlepšie veci.
              </p>
            </header>

            {/* Individual sections */}
            <WhyCompetitionsSection sectionNumberer={sectionNumberer} />
            <CompetitionsListSection sectionNumberer={sectionNumberer} />
            <ResourcesSection sectionNumberer={sectionNumberer} />
            <BeginnerGuideSection sectionNumberer={sectionNumberer} />
          </div>

          <aside className="mt-8">
            <TableOfContents items={guideTableOfContents} />
          </aside>
        </div>
      </div>

      <MobileTableOfContents items={guideTableOfContents} />
    </>
  )
}
