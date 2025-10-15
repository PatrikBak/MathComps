import { Star, User, Users } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { CountryBadge } from './layout/CountryBadge'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import type { Country } from './layout/FlagIcon'
import { GUIDE_SECTION_IDS } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { InfoCard } from './layout/InfoCard'
import { type SchoolLevel as ScholLevel, SchoolLevelBadge } from './layout/SchoolLevelBadge'

type CompetitionType = 'Team' | 'Individual'

type OtherCompetition = {
  title: string
  links: string[]
  description?: string
  details?: string[]
  levels: ScholLevel[]
  countries: Country[]
  type: CompetitionType
}

export default function OtherCompetitionsSection({
  sectionNumberer,
}: {
  sectionNumberer: SectionNumberer
}) {
  const competitions: OtherCompetition[] = [
    {
      title: 'Náboj & Náboj Junior',
      links: ['https://math.naboj.org/', 'https://junior.naboj.org/'],
      description: 'Najpopulárnejšia tímová súťaž v našich končinách s úlohami na výsledok',
      levels: ['ZŠ', 'SŠ'],
      countries: ['CZ', 'SK', 'INTERNATIONAL'],
      type: 'Team',
    },
    {
      title: 'DuoGeo',
      links: ['https://duogeo.cz/'],
      description: 'Súťaž dvojíc v riešení geometrie olympiádneho typu',
      levels: ['ZŠ', 'SŠ'],
      countries: ['SK', 'CZ', 'PL'],
      type: 'Team',
    },
    {
      title: 'Maso',
      links: ['https://maso.mff.cuni.cz/'],
      description: 'Súťaž s úlohami ako v Náboji, kde sa za výslekdy odomykajú ťahy do hry',
      levels: ['ZŠ'],
      countries: ['CZ'],
      type: 'Team',
    },
    {
      title: 'Matematický klokan',
      links: ['https://matematickyklokan.sk/', 'https://matematickyklokan.upol.cz/'],
      description: 'Súťaž s výberom z možností',
      levels: ['ZŠ', 'SŠ'],
      countries: ['CZ', 'SK'],
      type: 'Individual',
    },
    {
      title: 'Pytagoriáda',
      links: ['https://nivam.sk/olympiady-a-sutaze/pytagoriada/', 'https://www.pythagoriada.cz/'],
      description: 'Súťaž, kde záleží na rýchlosti a správnosti výsledkov',
      levels: ['ZŠ'],
      countries: ['CZ', 'SK'],
      type: 'Individual',
    },
    {
      title: 'Pangea',
      links: ['https://www.pangeasoutez.cz/'],
      description: 'Súťaž podobná Matematickému klokanovi s tematickými úlohami',
      levels: ['ZŠ'],
      countries: ['CZ'],
      type: 'Individual',
    },
    {
      title: 'Attomat',
      links: ['https://akcie.p-mat.sk/attomat/'],
      description: 'Online súťaž s úlohami na výsledok',
      levels: ['ZŠ', 'SŠ'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      title: 'Maks a Maksík',
      links: ['https://talentida.sk/maks/', 'https://talentida.sk/maksik/'],
      description: 'Súťaž, kde sa úlohy riešia doma a výsledky nahrávajú online',
      levels: ['ZŠ'],
      countries: ['SK'],
      type: 'Individual',
    },
    {
      title: 'Logická olympiáda',
      links: ['https://www.logickaolympiada.cz', 'https://www.logickaolympiada.sk/'],
      description: 'Zo zrejmých dôvodov populárna súťaž medzi matematikmi',
      levels: ['ZŠ', 'SŠ'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      title: 'Mathrace',
      links: ['https://brkos.math.muni.cz/mathrace/'],
      description: 'Online súťaž s úlohami ako v Náboji, kde možno používať softvér a programovať',
      levels: ['SŠ'],
      countries: ['CZ', 'SK'],
      type: 'Team',
    },
    {
      title: 'Mathing',
      links: ['https://mathing.fme.vutbr.cz/'],
      description: 'Online súťaž s úlohami ako v olympiáde',
      levels: ['SŠ'],
      countries: ['CZ', 'SK'],
      type: 'Team',
    },
    {
      title: 'Brloh',
      links: ['https://brloh.math.muni.cz/'],
      description: 'Súťaž v riešení matematicko-logických úloh',
      levels: ['ZŠ', 'SŠ'],
      countries: ['SK', 'CZ'],
      type: 'Individual',
    },
    {
      title: 'Purple Comet',
      links: ['https://purplecomet.org/'],
      description: 'Medzinárodná súťaž podobná Náboju s viac ako 80 krajinami',
      levels: ['SŠ'],
      countries: ['INTERNATIONAL'],
      type: 'Team',
    },
  ]

  const renderCompetitionCard = (competition: OtherCompetition, index: number) => (
    <InfoCard key={index}>
      <div className="mb-2 sm:mb-3">
        {/* Header with levels and countries */}
        <div className="flex flex-col items-start gap-1 mb-2 sm:mb-3">
          <h4 className={cn(GUIDE_STYLES.cardTitle, 'mb-0')}>{competition.title}</h4>
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
        <p className={cn(GUIDE_STYLES.textNormal, 'leading-relaxed')}>{competition.description}</p>
        {competition.details && <BulletList items={competition.details} />}
      </div>
    </InfoCard>
  )

  function renderTypeGroup(type: CompetitionType) {
    const typeConfig = {
      Team: {
        id: GUIDE_SECTION_IDS.OTHER_COMPETITIONS_TEAM,
        description:
          'Tímové súťaže sú skvelou príležitosťou na zábavu s kamarátmi. Nie je teda prekvapením, že sú populárne a že ich je toľko.',
        icon: Users,
        iconColor: 'text-green-400',
        iconBackground: 'bg-green-500/10',
      },
      Individual: {
        id: GUIDE_SECTION_IDS.OTHER_COMPETITIONS_INDIVIDUAL,
        description:
          'Individuálne súťaže, ktoré majú iný formát než matematická olympiáda. Všetky nižšie uvedené vyžadujú iba výsledok, čím sa od nej líšia.',
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
        id={typeConfig[type].id}
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
      id={GUIDE_SECTION_IDS.OTHER_COMPETITIONS}
      description="Okrem olympiády a seminárov existuje mnoho ďalších súťaží s rôznymi formátmi, pričom väčšinou ide o jednodňové zábavné udalosti, na ktoré sa typicky netrénuje, ale o to menší nátlak na nich je 😌"
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
