import { ExternalLink, MedalIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { type Country, FlagIcon } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import TipBox from './layout/TipBox'

/**
 * Type definition for international competition cards.
 */
type InternationalCompetition = {
  id: string
  acronym: string
  fullName: string
  link?: string | undefined
  description: string
  details?: React.ReactNode[] | undefined
}

/**
 * Organization link card component for SK/CZ MO websites.
 */
function OrganizationLink({
  href,
  country,
  name,
  domain,
  colorScheme,
}: {
  href: string
  country: Country
  name: string
  domain: string
  colorScheme: 'blue' | 'red'
}) {
  const colors = {
    blue: {
      icon: 'group-hover:text-blue-400',
    },
    red: {
      icon: 'group-hover:text-red-400',
    },
  }[colorScheme]

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-br bg-slate-900/50 hover:bg-slate-800/50 border border-slate-600/50 transition-all"
    >
      <div className="flex-shrink-0">
        <FlagIcon country={country} flagHeight={24} flagWidth={32} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base text-white font-semibold mb-0.5">{name}</div>
        <div className="text-xs text-slate-400">{domain}</div>
      </div>
      <ExternalLink
        size={14}
        className={cn('sm:w-4 sm:h-4 text-slate-500 transition-colors flex-shrink-0', colors.icon)}
      />
    </a>
  )
}

/**
 * Component for rendering a clean international competition card with improved readability.
 * Uses vertical stacking for scalability and consistent font sizes.
 */
function CompetitionCard({ competition }: { competition: InternationalCompetition }) {
  return (
    <article
      id={competition.id}
      className={cn(GUIDE_STYLES.card, 'border-l border-l-slate-600/40')}
    >
      <div className="mb-2 sm:mb-3">
        <div className="mb-1.5 sm:mb-2">
          <h4 className={GUIDE_STYLES.cardTitleSmall}>{competition.acronym}</h4>
          <div className={GUIDE_STYLES.textAcronym}>({competition.fullName})</div>
        </div>
        {competition.link && (
          <div className="mb-1">
            <ExternalLinkButton href={competition.link} />
          </div>
        )}
      </div>
      <div className={GUIDE_STYLES.contentSpacing}>
        <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{competition.description}</p>
        {competition.details && competition.details.length > 0 && (
          <BulletList items={competition.details} className={GUIDE_STYLES.listSpacing} />
        )}
      </div>
    </article>
  )
}

export default function MathOlympiadSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  // Get guide translations
  const tGuide = useTranslations('guide')

  // Scoped translator for competition data - allows using t.raw() for details arrays
  const tCompetitions = useTranslations('guide.sections.mathOlympiad.competitions')

  // Scoped translator for elementary and high school categories to get points array
  const tElementary = useTranslations('guide.sections.mathOlympiad.elementaryCategories')
  const tHighSchool = useTranslations('guide.sections.mathOlympiad.highSchoolCategories')

  const internationalCompetitions: InternationalCompetition[] = [
    {
      id: 'imo',
      acronym: 'IMO',
      fullName: 'International Mathematical Olympiad',
      link: 'https://imo-official.org/',
      description: tCompetitions('imo.description'),
      details: tCompetitions.raw('imo.details') as string[],
    },
    {
      id: 'memo',
      acronym: 'MEMO',
      fullName: 'Middle European Mathematical Olympiad',
      link: 'https://memo-official.org/',
      description: tCompetitions('memo.description'),
      details: tCompetitions.raw('memo.details') as string[],
    },
    {
      id: 'egmo',
      acronym: 'EGMO',
      fullName: "European Girls' Mathematical Olympiad",
      link: 'https://egmo.org/',
      description: tCompetitions('egmo.description'),
      details: tCompetitions.raw('egmo.details') as string[],
    },
    {
      id: 'caps',
      acronym: 'CAPS',
      fullName: 'Czech Austrian Polish Slovak Match',
      description: tCompetitions('caps.description'),
      details: tCompetitions.raw('caps.details') as string[],
    },
    {
      id: 'cpsj',
      acronym: 'CPSJ',
      fullName: 'Czech-Polish-Slovak Junior Match',
      description: tCompetitions('cpsj.description'),
      details: tCompetitions.raw('cpsj.details') as string[],
    },
  ]

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.MATH_OLYMPIAD}`)}
      description={
        <>
          {tGuide('sections.mathOlympiad.description')}{' '}
          <AppLink href="#imo" className={GUIDE_STYLES.link}>
            {tGuide('sections.mathOlympiad.imoLink')}
          </AppLink>
          .
        </>
      }
      icon={{ type: 'lucide', icon: MedalIcon }}
      iconColor="text-amber-400"
      iconBackground="bg-amber-500/10"
      sectionNumberer={sectionNumberer}
    >
      {/* Main content container */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        <div className="relative border border-blue-500/20 rounded-lg p-4 sm:p-5 bg-slate-900/30 overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl"></div>
          <div className="relative">
            <p className={cn(GUIDE_STYLES.textNormal, 'mb-3 sm:mb-4')}>
              {tGuide('sections.mathOlympiad.sharedTasks')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              <OrganizationLink
                href="https://skmo.sk/"
                country="SK"
                name={tGuide('sections.mathOlympiad.organizations.sk')}
                domain="skmo.sk"
                colorScheme="blue"
              />
              <OrganizationLink
                href="https://matematickaolympiada.cz/"
                country="CZ"
                name={tGuide('sections.mathOlympiad.organizations.cz')}
                domain="matematickaolympiada.cz"
                colorScheme="red"
              />
            </div>
          </div>
        </div>

        <p className={cn(GUIDE_STYLES.textNormal, 'my-4 sm:my-6')}>
          {tGuide('sections.mathOlympiad.categoriesIntro')}{' '}
          <span className="text-purple-400 font-semibold">
            {tGuide('sections.mathOlympiad.elementary')}
          </span>{' '}
          {tGuide('sections.mathOlympiad.and')}{' '}
          <span className="text-orange-400 font-semibold">
            {tGuide('sections.mathOlympiad.highSchool')}
          </span>{' '}
          {tGuide('sections.mathOlympiad.categoriesOutro')}
        </p>
      </div>

      {/* Main content container */}
      <div className={GUIDE_STYLES.sectionSpacing}>
        {/* ZŠ kategórie */}
        <div className={GUIDE_STYLES.cardLarge}>
          <h4 className={cn(GUIDE_STYLES.schoolCommon, GUIDE_STYLES.elementaryColor)}>
            {tElementary('title')}
          </h4>
          <BulletList
            items={[tElementary('point1'), tElementary('point2'), tElementary('point3')]}
            className={GUIDE_STYLES.listSpacing}
          />
        </div>

        {/* SŠ kategórie */}
        <div className={GUIDE_STYLES.cardLarge}>
          <h4 className={cn(GUIDE_STYLES.schoolCommon, GUIDE_STYLES.highSchoolColor)}>
            {tHighSchool('title')}
          </h4>
          <BulletList
            items={[
              tHighSchool('point1'),
              tHighSchool('point2'),
              <>
                {tHighSchool('point3')}{' '}
                <HelpTooltip content={<>{tHighSchool('selectionNote')}</>} />
              </>,
              tHighSchool.rich('point4', {
                strong: (chunks) => <strong>{chunks}</strong>,
              }),
              tHighSchool('point5'),
              tHighSchool('point6'),
            ]}
            className={cn(GUIDE_STYLES.listSpacing, 'mb-4 sm:mb-5')}
          />

          {/* IMO and MEMO cards stacked */}
          <div className="space-y-4 sm:space-y-5 mb-4 sm:mb-5">
            <CompetitionCard competition={internationalCompetitions[0]} />
            <CompetitionCard competition={internationalCompetitions[1]} />
          </div>

          {/* Other international competitions */}
          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-slate-700/50">
            <p className={cn(GUIDE_STYLES.textNormal, 'mb-3 sm:mb-4 font-medium')}>
              {tGuide('sections.mathOlympiad.otherCompetitions')}
            </p>
            <div className="space-y-4 sm:space-y-5">
              {internationalCompetitions.slice(2).map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))}
            </div>
          </div>
        </div>

        {/* Tip box */}
        <TipBox>{tGuide('sections.mathOlympiad.tip')}</TipBox>
      </div>
    </GuideSection>
  )
}
