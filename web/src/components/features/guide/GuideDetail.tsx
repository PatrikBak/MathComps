import React from 'react'

import Layout from '@/components/layout/Layout'
import { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import BeginnerGuideSection from './BeginnerGuideSection'
import CompetitionsListSection from './CompetitionsListSection'
import { guideTableOfContents } from './layout/guide-structure'
import ResourcesSection from './ResourcesSection'
import WhyCompetitionsSection from './WhyCompetitionsSection'

export default function GuideDetail() {
  // A helper type to get the section titles
  const sectionNumberer = new SectionNumberer(guideTableOfContents)

  return (
    <Layout tocItems={guideTableOfContents}>
      <div className="space-y-6 sm:space-y-8 md:space-y-10">
        <header>
          <div className="mb-4 sm:mb-6">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Rozcestník súťažnej matematiky
            </h1>
          </div>
          <p className="text-base sm:text-lg md:text-xl text-slate-400 max-w-4xl leading-relaxed">
            Zoznam súťaží a rôznych užitočných odkazov týkajúcich sa súťažnej matematiky. Plán je
            tieto sekcie priebežne dopĺňať o tie najlepšie veci.
          </p>
        </header>

        {/* Individual sections */}
        <WhyCompetitionsSection sectionNumberer={sectionNumberer} />
        <CompetitionsListSection sectionNumberer={sectionNumberer} />
        <ResourcesSection sectionNumberer={sectionNumberer} />
        <BeginnerGuideSection sectionNumberer={sectionNumberer} />
      </div>
    </Layout>
  )
}
