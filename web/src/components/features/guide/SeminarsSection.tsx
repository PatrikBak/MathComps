import { Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import type messages from '../../../../messages/sk.json'
import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { FlagIcon } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GUIDE_STYLES } from './layout/guide-styles'
import { GuideSection } from './layout/GuideSection'
import { type SchoolLevel, SchoolLevelBadge } from './layout/SchoolLevelBadge'
import TipBox from './layout/TipBox'

type Country = 'SK' | 'CZ' | 'INTERNATIONAL'

type SeminarDescriptionKey = keyof (typeof messages)['guide']['sections']['seminars']['items']

type Seminar = {
  title: string
  link: string
  /** Translation key for description in sections.seminars.items */
  descriptionKey?: SeminarDescriptionKey
  details?: string[]
  level: SchoolLevel
  country: Country
}

/**
 * Section showcasing correspondence seminars and training programs.
 * Uses a clean, list-based layout emphasizing key information over visual effects.
 */
export default function SeminarsSection({ sectionNumberer }: { sectionNumberer: SectionNumberer }) {
  // Common guide translations
  const tGuide = useTranslations('guide')

  // Scoped translator for seminar common content
  const tSeminars = useTranslations('guide.sections.seminars')

  const seminars: Seminar[] = [
    {
      title: 'KMS',
      link: 'https://kms.sk/',
      level: 'highSchool',
      country: 'SK',
    },
    {
      title: 'Strom',
      link: 'https://strom.sk/strom',
      level: 'highSchool',
      country: 'SK',
    },
    {
      title: 'PraSe',
      link: 'https://prase.cz/',
      level: 'highSchool',
      country: 'CZ',
    },
    {
      title: 'BRKOS',
      link: 'https://brkos.math.muni.cz/',
      level: 'highSchool',
      country: 'CZ',
    },
    {
      title: 'iKS',
      link: 'https://iksko.org/',
      descriptionKey: 'iks',
      level: 'highSchool',
      country: 'INTERNATIONAL',
    },
    {
      title: 'MBL',
      link: 'https://mathsbeyondlimits.eu/',
      descriptionKey: 'mbl',
      level: 'highSchool',
      country: 'INTERNATIONAL',
    },
    {
      title: 'Riešky',
      link: 'https://riesky.sk/',
      level: 'elementary',
      country: 'SK',
    },
    {
      title: 'Pikomat',
      link: 'https://pikomat.sk/',
      level: 'elementary',
      country: 'SK',
    },
    {
      title: 'Sezam',
      link: 'https://www.sezam.sk/',
      level: 'elementary',
      descriptionKey: 'sezam',
      country: 'SK',
    },
    {
      title: 'Sezamko',
      link: 'https://www.sezam.sk/sezamko/',
      level: 'elementary',
      descriptionKey: 'sezamko',
      country: 'SK',
    },
    {
      title: 'Matik',
      link: 'https://strom.sk/matik',
      level: 'elementary',
      descriptionKey: 'matik',
      country: 'SK',
    },
    {
      title: 'Malynár',
      link: 'https://strom.sk/malynar',
      level: 'elementary',
      descriptionKey: 'malynar',
      country: 'SK',
    },
    {
      title: 'Pikomat',
      link: 'https://pikomat.mff.cuni.cz/',
      level: 'elementary',
      country: 'CZ',
    },
    {
      title: 'Komár',
      link: 'https://komar.math.muni.cz/',
      level: 'elementary',
      country: 'CZ',
    },
    {
      title: 'KoKoS',
      link: 'http://kokos.gmk.cz/',
      descriptionKey: 'kokos',
      level: 'elementary',
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

        {seminar.descriptionKey && (
          <p className={cn(GUIDE_STYLES.textSmall, 'leading-relaxed mt-1.5')}>
            {tGuide(`sections.seminars.items.${seminar.descriptionKey}`)}
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

  const renderCountryGroup = (country: Country, level: SchoolLevel) => {
    const rightSeminars = seminars
      .filter((seminar) => seminar.country == country && seminar.level == level)
      .map(renderSeminarRow)

    return rightSeminars.length == 0 ? null : (
      <div className="mb-10 last:mb-0">
        <div className="flex items-center gap-2.5 mb-4">
          <FlagIcon country={country} className="h-5 w-7" />
          <h4
            className={cn(
              GUIDE_STYLES.textSmall,
              'font-semibold uppercase tracking-wide text-white/70'
            )}
          >
            {tGuide(`sections.seminars.countries.${country}`)}
          </h4>
        </div>
        <div className="space-y-2.5">{rightSeminars}</div>
      </div>
    )
  }

  function renderLevelGroup(level: SchoolLevel) {
    const levelConfig = {
      elementary: {
        title: tGuide(`titles.${GUIDE_TITLES.SEMINARS_ELEMENTARY}`),
        description: tGuide('sections.seminars.levels.elementary.description'),
        iconColor: 'text-purple-400',
        iconBackground: 'bg-purple-500/10',
      },
      highSchool: {
        title: tGuide(`titles.${GUIDE_TITLES.SEMINARS_HIGH_SCHOOL}`),
        description: tGuide('sections.seminars.levels.highSchool.description'),
        iconColor: 'text-orange-400',
        iconBackground: 'bg-orange-500/10',
      },
    }

    return (
      <GuideSection
        title={levelConfig[level].title}
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

  const features = tSeminars.raw('features') as string[]

  return (
    <GuideSection
      title={tGuide(`titles.${GUIDE_TITLES.SEMINARS}`)}
      description={
        <>
          <p>{tGuide('sections.seminars.description')}</p>
          <BulletList className="mt-4" items={features} />
        </>
      }
      icon={{ type: 'lucide', icon: Mail }}
      iconColor="text-blue-400"
      iconBackground="bg-blue-500/10"
      sectionNumberer={sectionNumberer}
    >
      {renderLevelGroup('elementary')}
      {renderLevelGroup('highSchool')}

      <TipBox>{tGuide('sections.seminars.tip')}</TipBox>
    </GuideSection>
  )
}
