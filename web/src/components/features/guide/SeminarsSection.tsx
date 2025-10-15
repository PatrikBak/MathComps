import { Mail } from 'lucide-react'
import React from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { FlagIcon } from './layout/FlagIcon'
import { GUIDE_SECTION_IDS } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { SchoolLevelBadge } from './layout/SchoolLevelBadge'
import TipBox from './layout/TipBox'

type Level = 'ZŠ' | 'SŠ'

type Country = 'SK' | 'CZ' | 'INTERNATIONAL'

type Seminar = {
  title: string
  link: string
  description?: string
  details?: string[]
  level: Level
  country: Country
}

/**
 * Section showcasing correspondence seminars and training programs.
 * Uses a clean, list-based layout emphasizing key information over visual effects.
 */
export default function SeminarsSection({ sectionNumberer }: { sectionNumberer: SectionNumberer }) {
  const seminars: Seminar[] = [
    {
      title: 'KMS',
      link: 'https://kms.sk/',
      level: 'SŠ',
      country: 'SK',
    },
    {
      title: 'Strom',
      link: 'https://strom.sk/strom',
      level: 'SŠ',
      country: 'SK',
    },
    {
      title: 'PraSe',
      link: 'https://prase.cz/',
      level: 'SŠ',
      country: 'CZ',
    },
    {
      title: 'BRKOS',
      link: 'https://brkos.math.muni.cz/',
      level: 'SŠ',
      country: 'CZ',
    },
    {
      title: 'iKS',
      link: 'https://iksko.org/',
      description:
        'Česko-slovenský seminár pre riešiteľov s ambíciou uspieť na medzinárodných kolách',
      level: 'SŠ',
      country: 'INTERNATIONAL',
    },
    {
      title: 'MBL',
      link: 'https://mathsbeyondlimits.eu/',
      description:
        'Pôvodne poľský, teraz už medzinárodný seminár s jedným kolom a jedným dlhým sústredením',
      level: 'SŠ',
      country: 'INTERNATIONAL',
    },
    {
      title: 'Riešky',
      link: 'https://riesky.sk/',
      level: 'ZŠ',
      country: 'SK',
    },
    {
      title: 'Pikomat',
      link: 'https://pikomat.sk/',
      level: 'ZŠ',
      country: 'SK',
    },
    {
      title: 'Sezam',
      link: 'https://www.sezam.sk/',
      level: 'ZŠ',
      description: 'Pre 7.-9. ročník ZŠ',
      country: 'SK',
    },
    {
      title: 'Sezamko',
      link: 'https://www.sezam.sk/sezamko/',
      level: 'ZŠ',
      description: 'Pre 4.-6. ročník ZŠ',
      country: 'SK',
    },
    {
      title: 'Matik',
      link: 'https://strom.sk/matik',
      level: 'ZŠ',
      description: 'Pre 7.-9. ročník ZŠ',
      country: 'SK',
    },
    {
      title: 'Malynár',
      link: 'https://strom.sk/malynar',
      level: 'ZŠ',
      description: 'Pre 4.-6. ročník ZŠ',
      country: 'SK',
    },
    {
      title: 'Pikomat',
      link: 'https://pikomat.mff.cuni.cz/',
      level: 'ZŠ',
      country: 'CZ',
    },
    {
      title: 'Komár',
      link: 'https://komar.math.muni.cz/',
      level: 'ZŠ',
      country: 'CZ',
    },
    {
      title: 'KoKoS',
      link: 'http://kokos.gmk.cz/',
      description: 'Pre 6.-9. ročník ZŠ',
      level: 'ZŠ',
      country: 'CZ',
    },
  ]

  const renderSeminarRow = (seminar: Seminar, index: number) => (
    <div
      key={index}
      className="group relative flex items-start gap-3 py-4 px-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200"
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <h4
            className={cn(
              GUIDE_STYLES.cardTitleSmall,
              'font-semibold group-hover:text-white transition-colors'
            )}
          >
            {seminar.title}
          </h4>
          <ExternalLinkButton href={seminar.link} />
        </div>

        {seminar.description && (
          <p className={cn(GUIDE_STYLES.textSmall, 'leading-relaxed mt-1.5')}>
            {seminar.description}
          </p>
        )}

        {seminar.details && (
          <div className="mt-2">
            <BulletList items={seminar.details} />
          </div>
        )}
      </div>
    </div>
  )

  const renderCountryGroup = (country: Country, level: Level) => {
    const rightSeminars = seminars
      .filter((seminar) => seminar.country == country && seminar.level == level)
      .map(renderSeminarRow)

    return rightSeminars.length == 0 ? null : (
      <div className="mb-10 last:mb-0">
        <div className="flex items-center gap-2.5 mb-4">
          <FlagIcon countries={[country]} className="h-5 w-7" />
          <h4
            className={cn(
              GUIDE_STYLES.textSmall,
              'font-semibold uppercase tracking-wide text-white/70'
            )}
          >
            {
              {
                SK: 'Slovenské',
                CZ: 'České',
                INTERNATIONAL: 'Medzinárodné',
              }[country]
            }
          </h4>
        </div>
        <div className="space-y-2.5">{rightSeminars}</div>
      </div>
    )
  }

  function renderLevelGroup(level: Level) {
    const levelConfig = {
      ZŠ: {
        id: GUIDE_SECTION_IDS.SEMINARS_ELEMENTARY,
        description:
          'ZŠ seminárov je naozaj dosť. Väčšina z nich je pre všeobecne druhý stupeň ZŠ, pričom ale majú škálované príklady pre všetkých.',
        iconColor: 'text-purple-400',
        iconBackground: 'bg-purple-500/10',
      },
      SŠ: {
        id: GUIDE_SECTION_IDS.SEMINARS_HIGH_SCHOOL,
        description:
          'Dva slovenské, dva české a jeden česko-slovenský. Okrem toho veľa česko-slovenských študentov sa zúčastňuje aj MBL. O zábavu naozaj nie je núdza.',
        iconColor: 'text-orange-400',
        iconBackground: 'bg-orange-500/10',
      },
    }

    return (
      <GuideSection
        id={levelConfig[level].id}
        description={levelConfig[level].description}
        icon={{ type: 'custom', icon: <SchoolLevelBadge level={level} /> }}
        iconColor={levelConfig[level].iconColor}
        iconBackground={levelConfig[level].iconBackground}
        sectionNumberer={sectionNumberer}
      >
        <div className="mt-8">
          {renderCountryGroup('SK', level)}
          {renderCountryGroup('CZ', level)}
          {renderCountryGroup('INTERNATIONAL', level)}
        </div>
      </GuideSection>
    )
  }

  return (
    <GuideSection
      id={GUIDE_SECTION_IDS.SEMINARS}
      description={
        <>
          <p>
            Korešpondenčné semináre sú neoddeliteľnou súčasťou česko-slovenskej matematickej
            kultúry, čomu zodpovedá aj ich počet. Typické vlastnosti:
          </p>
          <BulletList
            className="mt-4"
            items={[
              'Riešenie úloh doma a zasielanie riešení poštou (odtiaľ názov), aj keď teraz už skôr online',
              'Niekoľko sérií úloh počas roka',
              'Sústredenia nabité zábavou a matikou ako neodmysliteľná súčasť seminárov',
            ]}
          />
        </>
      }
      icon={{ type: 'lucide', icon: Mail }}
      iconColor="text-blue-400"
      iconBackground="bg-blue-500/10"
      sectionNumberer={sectionNumberer}
    >
      {renderLevelGroup('ZŠ')}
      {renderLevelGroup('SŠ')}

      <TipBox>
        Veľa ľudí rieši súčasne viac seminárov, a to aj na ZŠ aj na SŠ. Je tiež bežné pre Slovákov
        riešiť české semináre a naopak. Nie je náhoda, že medzi najlepšími riešiteľmi MO a seminárov
        je veľký prekryv 😉
      </TipBox>
    </GuideSection>
  )
}
