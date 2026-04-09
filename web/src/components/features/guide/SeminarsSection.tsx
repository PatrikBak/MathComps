import { Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'

import type { AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import type { SectionNumberer } from '@/components/table-of-contents/SectionNumberer'

import type messages from '../../../../messages/sk.json'
import { BulletList } from './layout/BulletList'
import { ExternalLinkButton } from './layout/ExternalLinkButton'
import { FlagIcon } from './layout/FlagIcon'
import { GUIDE_TITLES } from './layout/guide-structure'
import { GuideHeading } from './layout/GuideHeading'
import { GuideSection } from './layout/GuideSection'
import { GuideText } from './layout/GuideText'
import { type SchoolLevel, SchoolLevelBadge } from './layout/SchoolLevelBadge'
import TipBox from './layout/TipBox'

/** Country code used for seminar geographic tagging. */
type Country = 'SK' | 'CZ' | 'INTERNATIONAL'

/** Translation key for seminar item descriptions. */
type SeminarDescriptionKey = keyof (typeof messages)['guide']['sections']['seminars']['items']

/**
 * Data model for a single seminar entry.
 */
type Seminar = {
  /** Seminar display name (e.g., "KMS"). */
  title: string
  /** External URL to the seminar homepage. */
  link: string
  /** Translation key for the localized description (if there's any). */
  descriptionKey?: SeminarDescriptionKey
  /** Optional bullet-point details. */
  details?: string[]
  /** Target school level. */
  level: SchoolLevel
  /** Country where the seminar operates. */
  country: Country
}

/**
 * Guide section showcasing correspondence seminars and training programs.
 * Renders a list-based layout grouped by school level.
 */
export default function SeminarsSection({ sectionNumberer }: { sectionNumberer: SectionNumberer }) {
  // Common guide translations
  const tGuide = useTranslations('guide')

  // Scoped translator for seminar common content
  const tSeminars = useTranslations('guide.sections.seminars')

  // List of all seminars to be rendered
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

  /**
   * Renders a single seminar row.
   *
   * @param seminar - The seminar to render.
   * @param index - The index of the seminar.
   * @returns The rendered seminar row.
   */
  const renderSeminarRow = (seminar: Seminar, index: number) => (
    <div
      key={index}
      className="group relative flex items-start gap-3 py-4 px-4 rounded-lg border border-foreground/10 bg-foreground/5 hover:bg-foreground/10 hover:border-foreground/15 transition-all duration-200"
    >
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <GuideHeading
            level="h4"
            className={cn(
              'text-base sm:text-lg',
              'font-semibold group-hover:text-foreground transition-colors'
            )}
          >
            {seminar.title}
          </GuideHeading>
          <ExternalLinkButton href={seminar.link} />
        </div>

        {seminar.descriptionKey && (
          <GuideText variant="small" color="muted" className="mt-1.5">
            {tGuide(`sections.seminars.items.${seminar.descriptionKey}`)}
          </GuideText>
        )}

        {seminar.details && (
          <div className="mt-2">
            <BulletList items={seminar.details} />
          </div>
        )}
      </div>
    </div>
  )

  /**
   * Renders a group of seminars for a specific country and school level.
   *
   * @param country - The country code.
   * @param level - The school level.
   * @returns The rendered country group.
   */
  const renderCountryGroup = (country: Country, level: SchoolLevel) => {
    // Filter seminars for the given country and level
    const rightSeminars = seminars
      .filter((seminar) => seminar.country == country && seminar.level == level)
      .map(renderSeminarRow)

    return rightSeminars.length == 0 ? null : (
      <div className="mb-10 last:mb-0">
        <div className="flex items-center gap-2.5 mb-4">
          <FlagIcon country={country} className="h-5 w-7" />
          <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground sm:text-base">
            {tGuide(`sections.seminars.countries.${country}`)}
          </h4>
        </div>
        <div className="space-y-2.5">{rightSeminars}</div>
      </div>
    )
  }

  /**
   * Renders a group of seminars for a specific school level.
   *
   * @param level - The school level.
   * @returns The rendered level group.
   */
  function renderLevelGroup(level: SchoolLevel) {
    // Get level-specific configuration
    const levelConfig = {
      elementary: {
        title: tGuide(`titles.${GUIDE_TITLES.SEMINARS_ELEMENTARY}`),
        description: tGuide('sections.seminars.levels.elementary.description'),
        accent: 'purple' as AccentColor,
      },
      highSchool: {
        title: tGuide(`titles.${GUIDE_TITLES.SEMINARS_HIGH_SCHOOL}`),
        description: tGuide('sections.seminars.levels.highSchool.description'),
        accent: 'orange' as AccentColor,
      },
    }

    return (
      <GuideSection
        title={levelConfig[level].title}
        description={levelConfig[level].description}
        icon={{ type: 'custom', icon: <SchoolLevelBadge level={level} /> }}
        accent={levelConfig[level].accent}
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

  // List of common seminar features to be rendered
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
      accent="blue"
      sectionNumberer={sectionNumberer}
    >
      {renderLevelGroup('elementary')}
      {renderLevelGroup('highSchool')}

      <TipBox>{tGuide('sections.seminars.tip')}</TipBox>
    </GuideSection>
  )
}
