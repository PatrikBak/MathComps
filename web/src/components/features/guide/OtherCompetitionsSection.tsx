import { Star, User, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

// Import messages to extract item keys for type safety
import type messages from '../../../../messages/sk.json'
import { BulletList } from './layout/BulletList'
import { CountryBadge } from './layout/CountryBadge'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import type { Country } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { InfoCard } from './layout/InfoCard'
import { type SchoolLevel, SchoolLevelBadge } from './layout/SchoolLevelBadge'

type ItemKey = keyof (typeof messages)['guide']['sections']['otherCompetitions']['items']

type CompetitionType = 'Team' | 'Individual'

type OtherCompetition = {
  titleKey: ItemKey
  links: string[]
  descriptionKey: ItemKey
  details?: string[]
  levels: SchoolLevel[]
  countries: Country[]
  type: CompetitionType
}

export default function OtherCompetitionsSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  // Main translator for general guide content (titles, descriptions, etc.)
  const tGuide = useTranslations('guide')

  // Scoped translator for individual competition item descriptions.
  const tItems = useTranslations('guide.sections.otherCompetitions.items')

  // Scoped translator for competition titles
  const tTitles = useTranslations('guide.sections.otherCompetitions.titles')

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

  const renderCompetitionCard = (competition: OtherCompetition, index: number) => (
    <InfoCard key={index}>
      <div className="mb-2 sm:mb-3">
        {/* Header with levels and countries */}
        <div className="flex flex-col items-start gap-1 mb-2 sm:mb-3">
          <h4 className={cn(GUIDE_STYLES.cardTitle, 'mb-0')}>{tTitles(competition.titleKey)}</h4>
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
      <div className={GUIDE_STYLES.contentSpacing}>
        <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>
          {tItems(competition.descriptionKey)}
        </p>
        {competition.details && <BulletList items={competition.details} />}
      </div>
    </InfoCard>
  )

  function renderTypeGroup(type: CompetitionType) {
    const typeConfig = {
      Team: {
        title: tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS_TEAM}`),
        description: tGuide('sections.otherCompetitions.team.description'),
        icon: Users,
        iconColor: 'text-green-400',
        iconBackground: 'bg-green-500/10',
      },
      Individual: {
        title: tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS_INDIVIDUAL}`),
        description: tGuide('sections.otherCompetitions.individual.description'),
        icon: User,
        iconColor: 'text-cyan-400',
        iconBackground: 'bg-cyan-500/10',
      },
    }

    const typeCompetitions = competitions
      .filter((competition) => competition.type === type)
      .map(renderCompetitionCard)

    return typeCompetitions.length === 0 ? null : (
      <GuideSection
        title={typeConfig[type].title}
        description={typeConfig[type].description}
        icon={{ type: 'lucide', icon: typeConfig[type].icon }}
        iconColor={typeConfig[type].iconColor}
        iconBackground={typeConfig[type].iconBackground}
        sectionNumberer={sectionNumberer}
      >
        <div className={GUIDE_STYLES.sectionSpacing}>{typeCompetitions}</div>
      </GuideSection>
    )
  }

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.OTHER_COMPETITIONS}`)}
      description={tGuide('sections.otherCompetitions.description')}
      icon={{ type: 'lucide', icon: Star }}
      iconColor="text-violet-400"
      iconBackground="bg-violet-500/10"
      sectionNumberer={sectionNumberer}
    >
      {renderTypeGroup('Team')}
      {renderTypeGroup('Individual')}
    </GuideSection>
  )
}
