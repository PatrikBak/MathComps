import { ExternalLink, MedalIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { OLYMPIAD_GLOW_PALETTE, SCHOOL_LEVEL_COLORS } from './guide-colors'
import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { type Country, FlagIcon } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideCard } from './layout/GuideCard'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'
import TipBox from './layout/TipBox'

/**
 * Data model for an international math competition card.
 */
type InternationalCompetition = {
  /** Unique ID for anchor linking. */
  id: string
  /** Short name displayed as the card heading (e.g., "IMO"). */
  acronym: string
  /** Full competition name shown below the acronym. */
  fullName: string
  /** External URL to the competition website. */
  link?: string | undefined
  /** Localized description text. */
  description: string
  /** Optional bullet-point details rendered below the description. */
  details?: React.ReactNode[] | undefined
}

/**
 * Props for the {@link OrganizationLink} component.
 */
type OrganizationLinkProps = {
  /** Destination URL. */
  href: string
  /** Country flag to display. */
  country: Country
  /** Organization display name. */
  name: string
  /** Domain text shown below the name. */
  domain: string
  /** Decorative accent color for the hover effect. */
  colorScheme: AccentColor
}

/**
 * Organization link card component for SK/CZ MO websites.
 */
function OrganizationLink({ href, country, name, domain, colorScheme }: OrganizationLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg bg-gradient-to-br bg-surface/20 hover:bg-surface/50 border border-surface/50 transition-all"
    >
      <div className="flex-shrink-0">
        <FlagIcon country={country} flagHeight={24} flagWidth={32} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm sm:text-base text-foreground font-semibold mb-0.5">{name}</div>
        <div className="text-xs text-muted">{domain}</div>
      </div>
      <ExternalLink
        size={14}
        className={cn(
          'sm:w-4 sm:h-4 text-muted transition-colors flex-shrink-0',
          ACCENT_COLOR_MAP[colorScheme].groupHoverText
        )}
      />
    </a>
  )
}

/**
 * Props for the {@link CompetitionCard} component.
 */
type CompetitionCardProps = {
  /** Competition data to render. */
  competition: InternationalCompetition
}

/**
 * Renders a clean international competition card with vertical stacking
 * for acronym, full name, link, description, and optional details.
 */
function CompetitionCard({ competition }: CompetitionCardProps) {
  return (
    <GuideCard id={competition.id} className="border-l border-l-surface/40">
      <div className="mb-2 sm:mb-3">
        <div className="mb-1.5 sm:mb-2">
          <GuideHeading level="h4">{competition.acronym}</GuideHeading>
          <GuideText variant="acronym">({competition.fullName})</GuideText>
        </div>
        {competition.link && (
          <div className="mb-1">
            <ExternalLinkButton href={competition.link} />
          </div>
        )}
      </div>
      <div className="space-y-2 sm:space-y-3">
        <GuideText>{competition.description}</GuideText>
        {competition.details && competition.details.length > 0 && (
          <BulletList items={competition.details} />
        )}
      </div>
    </GuideCard>
  )
}

/**
 * Props for the {@link MathOlympiadSection} component.
 */
type MathOlympiadSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Guide section covering the Math Olympiad ecosystem:
 * SK/CZ organization links, category breakdowns, and international competitions.
 */
export default function MathOlympiadSection({ sectionNumberer }: MathOlympiadSectionProps) {
  // Get guide translations
  const tGuide = useTranslations('guide')

  // Scoped translator for competition data - allows using t.raw() for details arrays
  const tCompetitions = useTranslations('guide.sections.mathOlympiad.competitions')

  // Scoped translator for elementary and high school categories to get points array
  const tElementary = useTranslations('guide.sections.mathOlympiad.elementaryCategories')
  const tHighSchool = useTranslations('guide.sections.mathOlympiad.highSchoolCategories')

  // List of all international competitions to be rendered
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
          <AppLink
            href="#imo"
            className="text-link underline transition-colors hover:text-link-hover"
          >
            {tGuide('sections.mathOlympiad.imoLink')}
          </AppLink>
          .
        </>
      }
      icon={{ type: 'lucide', icon: MedalIcon }}
      accent="amber"
      sectionNumberer={sectionNumberer}
    >
      {/* Main content container */}
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div
          className={cn(
            'relative rounded-lg p-4 sm:p-5 bg-surface/10 overflow-hidden border',
            OLYMPIAD_GLOW_PALETTE.containerBorder
          )}
        >
          <div
            className={cn(
              'absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl',
              OLYMPIAD_GLOW_PALETTE.glowBg
            )}
          ></div>
          <div className="relative">
            <GuideText className="mb-3 sm:mb-4">
              {tGuide('sections.mathOlympiad.sharedTasks')}
            </GuideText>
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

        <GuideText className="my-4 sm:my-6">
          {tGuide('sections.mathOlympiad.categoriesIntro')}{' '}
          <span className={cn('font-semibold', SCHOOL_LEVEL_COLORS.elementary)}>
            {tGuide('sections.mathOlympiad.elementary')}
          </span>{' '}
          {tGuide('sections.mathOlympiad.and')}{' '}
          <span className={cn('font-semibold', SCHOOL_LEVEL_COLORS.highSchool)}>
            {tGuide('sections.mathOlympiad.highSchool')}
          </span>{' '}
          {tGuide('sections.mathOlympiad.categoriesOutro')}
        </GuideText>
      </div>

      {/* Main content container */}
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* ZŠ kategórie */}
        <GuideCard variant="large">
          <GuideHeading
            level="h3"
            className={cn('mb-3 flex items-center gap-2 sm:mb-4', SCHOOL_LEVEL_COLORS.elementary)}
          >
            {tElementary('title')}
          </GuideHeading>
          <BulletList
            items={[tElementary('point1'), tElementary('point2'), tElementary('point3')]}
          />
        </GuideCard>

        {/* SŠ kategórie */}
        <GuideCard variant="large">
          <GuideHeading
            level="h3"
            className={cn('mb-3 flex items-center gap-2 sm:mb-4', SCHOOL_LEVEL_COLORS.highSchool)}
          >
            {tHighSchool('title')}
          </GuideHeading>
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
            className="mb-4 sm:mb-5"
          />

          {/* IMO and MEMO cards stacked */}
          <div className="space-y-4 sm:space-y-5 mb-4 sm:mb-5">
            <CompetitionCard competition={internationalCompetitions[0]} />
            <CompetitionCard competition={internationalCompetitions[1]} />
          </div>

          {/* Other international competitions */}
          <div className="mt-5 sm:mt-6 pt-4 sm:pt-5 border-t border-surface/50">
            <GuideText className="mb-3 font-medium sm:mb-4">
              {tGuide('sections.mathOlympiad.otherCompetitions')}
            </GuideText>
            <div className="space-y-4 sm:space-y-5">
              {internationalCompetitions.slice(2).map((competition) => (
                <CompetitionCard key={competition.id} competition={competition} />
              ))}
            </div>
          </div>
        </GuideCard>

        {/* Tip box */}
        <TipBox>{tGuide('sections.mathOlympiad.tip')}</TipBox>
      </div>
    </GuideSection>
  )
}
