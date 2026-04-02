import { Star, User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

// Import messages to extract item keys for type safety
import type messages from '../../../../messages/sk.json'
import { BulletList } from './layout/BulletList'
import { CountryBadge } from './layout/CountryBadge'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import type { Country } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideCard } from './layout/GuideCard'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'
import { type SchoolLevel, SchoolLevelBadge } from './layout/SchoolLevelBadge'

/** Translation key for competition item descriptions. */
type ItemKey = keyof (typeof messages)['guide']['sections']['otherCompetitions']['items']

/** Whether a competition is team-based or individual. */
type CompetitionType = 'Team' | 'Individual'

/**
 * Data model for a single competition entry in the "Other Competitions" section.
 */
type OtherCompetition = {
  /** Translation key used to look up the competition title. */
  titleKey: ItemKey
  /** External URLs to the competition website(s). */
  links: string[]
  /** Translation key used to look up the competition description. */
  descriptionKey: ItemKey
  /** Optional bullet-point details. */
  details?: string[]
  /** School levels this competition targets. */
  levels: SchoolLevel[]
  /** Countries where the competition is available. */
  countries: Country[]
  /** Whether the competition is team or individual. */
  type: CompetitionType
}

/**
 * Props for the {@link OtherCompetitionsSection} component.
 */
type OtherCompetitionsSectionProps = {
  /** Section numberer for hierarchical section numbering. */
  sectionNumberer: SectionNumberer
}

/**
 * Guide section listing team and individual math competitions
 * beyond the main Math Olympiad (Náboj, Klokan, etc.).
 */
export default function OtherCompetitionsSection({
  sectionNumberer,
}: OtherCompetitionsSectionProps) {
  // Main translator for general guide content (titles, descriptions, etc.)
  const tGuide = useTranslations('guide')

  // Scoped translator for individual competition item descriptions.
  const tItems = useTranslations('guide.sections.otherCompetitions.items')

  // Scoped translator for competition titles
  const tTitles = useTranslations('guide.sections.otherCompetitions.titles')

  // All competitions including team and individual types
  const competitions: OtherCompetition[] = [
    {
      titleKey: 'naboj',
      links: ['https://math.naboj.org/', 'https://junior.naboj.org/'],
      descriptionKey: 'naboj',
      levels: ['elementary', 'highSchool'],
      countries: ['CZ', 'SK', 'INTERNATIONAL'],
      type: 'Team',
    },
    {
      titleKey: 'duogeo',
      links: ['https://duogeo.cz/'],
      descriptionKey: 'duogeo',
      levels: ['elementary', 'highSchool'],
      countries: ['SK', 'CZ', 'PL'],
      type: 'Team',
    },
    {
      titleKey: 'maso',
      links: ['https://maso.mff.cuni.cz/'],
      descriptionKey: 'maso',
      levels: ['elementary'],
      countries: ['CZ'],
      type: 'Team',
    },
    {
      titleKey: 'klokan',
      links: ['https://matematickyklokan.sk/', 'https://matematickyklokan.upol.cz/'],
      descriptionKey: 'klokan',
      levels: ['elementary', 'highSchool'],
      countries: ['CZ', 'SK'],
      type: 'Individual',
    },
    {
      titleKey: 'pytagoriada',
      links: ['https://nivam.sk/olympiady-a-sutaze/pytagoriada/', 'https://www.pythagoriada.cz/'],
      descriptionKey: 'pytagoriada',
      levels: ['elementary'],
      countries: ['CZ', 'SK'],
      type: 'Individual',
    },
    {
      titleKey: 'pangea',
      links: ['https://www.pangeasoutez.cz/'],
      descriptionKey: 'pangea',
      levels: ['elementary'],
      countries: ['CZ'],
      type: 'Individual',
    },
    {
      titleKey: 'attomat',
      links: ['https://akcie.p-mat.sk/attomat/'],
      descriptionKey: 'attomat',
      levels: ['elementary', 'highSchool'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      titleKey: 'maks',
      links: ['https://talentida.sk/maks/', 'https://talentida.sk/maksik/'],
      descriptionKey: 'maks',
      levels: ['elementary'],
      countries: ['SK'],
      type: 'Individual',
    },
    {
      titleKey: 'logickaOlympiada',
      links: ['https://www.logickaolympiada.cz', 'https://www.logickaolympiada.sk/'],
      descriptionKey: 'logickaOlympiada',
      levels: ['elementary', 'highSchool'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      titleKey: 'mathrace',
      links: ['https://brkos.math.muni.cz/mathrace/'],
      descriptionKey: 'mathrace',
      levels: ['highSchool'],
      countries: ['CZ', 'SK'],
      type: 'Team',
    },
    {
      titleKey: 'mathing',
      links: ['https://mathing.fme.vutbr.cz/'],
      descriptionKey: 'mathing',
      levels: ['highSchool'],
      countries: ['CZ', 'SK'],
      type: 'Team',
    },
    {
      titleKey: 'brloh',
      links: ['https://brloh.math.muni.cz/'],
      descriptionKey: 'brloh',
      levels: ['elementary', 'highSchool'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      titleKey: 'purpleComet',
      links: ['https://purplecomet.org/'],
      descriptionKey: 'purpleComet',
      levels: ['highSchool'],
      countries: ['INTERNATIONAL'],
      type: 'Team',
    },
  ]

  /**
   * Renders a single competition card.
   *
   * @param competition - The competition to render.
   * @param index - The index of the competition.
   * @returns The rendered competition card.
   */
  const renderCompetitionCard = (competition: OtherCompetition, index: number) => (
    <GuideCard key={index}>
      <div className="mb-2 sm:mb-3">
        {/* Header with levels and countries */}
        <div className="flex flex-col items-start gap-1 mb-2 sm:mb-3">
          <GuideHeading level="h3" className="mb-0">
            {tTitles(competition.titleKey)}
          </GuideHeading>
          <div className="flex items-center gap-2.5">
            {competition.levels.map((level) => (
              <SchoolLevelBadge key={level} level={level} />
            ))}
            <CountryBadge countries={competition.countries} size="md" />
          </div>
        </div>
      </div>

      {/* Links */}
      {competition.links.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-3">
          {competition.links.map((link, linkIndex) => (
            <ExternalLinkButton key={linkIndex} href={link} />
          ))}
        </div>
      )}

      {/* Description and details */}
      <div className="space-y-2 sm:space-y-3">
        <GuideText>{tItems(competition.descriptionKey)}</GuideText>
        {competition.details && <BulletList items={competition.details} />}
      </div>
    </GuideCard>
  )

  // Render a subsection grouping competitions by team/individual type
  function renderTypeGroup(type: CompetitionType) {
    // Section header configuration for each type
    const typeConfig = {
      Team: {
        title: tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS_TEAM}`),
        description: tGuide('sections.otherCompetitions.team.description'),
        icon: Users,
        accent: 'emerald' as const,
      },
      Individual: {
        title: tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS_INDIVIDUAL}`),
        description: tGuide('sections.otherCompetitions.individual.description'),
        icon: User,
        accent: 'cyan' as const,
      },
    }

    // Filter competitions matching this type and render their cards
    const typeCompetitions = competitions
      .filter((competition) => competition.type === type)
      .map(renderCompetitionCard)

    // Skip rendering if no competitions match
    return typeCompetitions.length === 0 ? null : (
      <GuideSection
        title={typeConfig[type].title}
        description={typeConfig[type].description}
        icon={{ type: 'lucide', icon: typeConfig[type].icon }}
        accent={typeConfig[type].accent}
        sectionNumberer={sectionNumberer}
      >
        <div className="space-y-4 sm:space-y-5 md:space-y-6">{typeCompetitions}</div>
      </GuideSection>
    )
  }

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS}`)}
      description={tGuide('sections.otherCompetitions.description')}
      icon={{ type: 'lucide', icon: Star }}
      accent="purple"
      sectionNumberer={sectionNumberer}
    >
      {renderTypeGroup('Team')}
      {renderTypeGroup('Individual')}
    </GuideSection>
  )
}
