import { ExternalLink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import React from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { HelpTooltip } from '@/components/shared/components/HelpTooltip'
import { ACCENT_COLOR_MAP, type AccentColor } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import { getDisplayDomain } from '@/components/shared/utils/url-utils'

import { InternationalCard } from '../components/guide-card-adapters'
import { SCHOOL_LEVEL_COLORS, SCHOOL_LEVEL_PANEL_COLORS } from '../content/guide-colors'
import { GUIDE_CONTENT } from '../content/guide-content'
import type { Country, SchoolLevel } from '../content/guide-content-types'
import { BulletList } from '../layout/BulletList'
import { FlagIcon } from '../layout/FlagIcon'
import { GuideHeading } from '../layout/GuideHeading'
import { GuideText } from '../layout/GuideText'
import TipBox from '../layout/TipBox'
import { DeckGrid, PageHeader } from './DeckPrimitives'

/**
 * Props for the {@link OrganizationLink} component.
 */
type OrganizationLinkProps = {
  /** The organization's website URL. */
  href: string
  /** The country whose flag leads the card. */
  country: Country
  /** The organization's display name. */
  name: string
  /** The accent color the card tints toward on hover. */
  accent: AccentColor
}

/**
 * A flat link card to a national MO organization, tinting toward its country color on hover.
 */
function OrganizationLink({ href, country, name, accent }: OrganizationLinkProps) {
  // The bare display domain
  const domain = getDisplayDomain(href)

  // The flag, the name + domain, and an outbound-link glyph
  return (
    <AppLink
      href={href}
      external
      newTab
      className={cn(
        'flex items-center gap-3 rounded-lg border border-foreground/10 bg-surface/30 p-3 transition-colors',
        ACCENT_COLOR_MAP[accent].hoverBorder,
        ACCENT_COLOR_MAP[accent].hoverBg
      )}
    >
      <FlagIcon country={country} flagHeight={24} flagWidth={32} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-foreground sm:text-base">{name}</div>
        <div className="text-xs text-muted">{domain}</div>
      </div>
      <ExternalLink size={14} className="flex-shrink-0 text-muted" />
    </AppLink>
  )
}

/**
 * Props for the {@link CategoryCard} component.
 */
type CategoryCardProps = {
  /** The school level this category targets (drives the title color + panel tint). */
  level: SchoolLevel
  /** The card title. */
  title: string
  /** The bullet items describing the category. */
  items: React.ReactNode[]
}

/**
 * A category card (elementary / high school) with a level-colored title and a faint level tint.
 */
function CategoryCard({ level, title, items }: CategoryCardProps) {
  // The level-tinted card: a title over its bullets
  return (
    <div className={cn('rounded-xl border p-4 sm:p-5', SCHOOL_LEVEL_PANEL_COLORS[level])}>
      <GuideHeading level="h3" className={cn('mb-3', SCHOOL_LEVEL_COLORS[level])}>
        {title}
      </GuideHeading>
      <BulletList items={items} />
    </div>
  )
}

/**
 * Deck page: the Math Olympiad ecosystem — categories, organizations, international competitions.
 */
export function OlympiadPage() {
  // General guide strings
  const tGuide = useTranslations('guide')
  // Elementary-school category labels
  const tElementary = useTranslations('guide.sections.mathOlympiad.elementaryCategories')
  // High-school category labels
  const tHighSchool = useTranslations('guide.sections.mathOlympiad.highSchoolCategories')
  // The international competitions' quick draws, as bullet items
  const internationalFeatures = tGuide.raw(
    'sections.mathOlympiad.international.features'
  ) as string[]
  // The IMO competition, whose official link the inline mention shares with its card
  const imoCompetition = GUIDE_CONTENT.internationalCompetitions.find(
    (competition) => competition.id === 'imo'
  )
  // The curated content always carries IMO; fail loudly if that ever stops being true
  if (!imoCompetition) throw new Error('Guide content is missing the IMO competition')

  // The MO definition, with an inline link out to the official IMO site
  const intro = (
    <>
      {tGuide('sections.mathOlympiad.description')}{' '}
      <AppLink
        href={imoCompetition.links[0].url}
        external
        newTab
        className="text-link underline transition-colors hover:text-link-hover"
      >
        {tGuide('sections.mathOlympiad.imoLink')}
      </AppLink>
      .
    </>
  )

  // The MO definition, organizations, categories, and international competitions
  return (
    <div>
      <PageHeader title={tGuide('titles.mathOlympiad')} description={intro} />

      <div className="space-y-6">
        {/* National organizations, fronted by the shared-problems note */}
        <div>
          <GuideText variant="small" className="mb-3">
            {tGuide('sections.mathOlympiad.sharedTasks')}
          </GuideText>
          {/* The two national MO bodies */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <OrganizationLink
              href="https://skmo.sk/"
              country="SK"
              name={tGuide('sections.mathOlympiad.organizations.sk')}
              accent="blue"
            />
            <OrganizationLink
              href="https://matematickaolympiada.cz/"
              country="CZ"
              name={tGuide('sections.mathOlympiad.organizations.cz')}
              accent="red"
            />
          </div>
        </div>

        {/* Composed categories sentence — one paragraph, two colored spans */}
        <GuideText as="p">
          {tGuide('sections.mathOlympiad.categoriesIntro')}{' '}
          <span className={cn('whitespace-nowrap font-semibold', SCHOOL_LEVEL_COLORS.elementary)}>
            {tGuide('sections.mathOlympiad.elementary')}
          </span>{' '}
          {tGuide('sections.mathOlympiad.and')}{' '}
          <span className={cn('whitespace-nowrap font-semibold', SCHOOL_LEVEL_COLORS.highSchool)}>
            {tGuide('sections.mathOlympiad.highSchool')}
          </span>
          {tGuide('sections.mathOlympiad.categoriesOutro')}
        </GuideText>

        {/* Category cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <CategoryCard
            level="elementary"
            title={tElementary('title')}
            items={[tElementary('point1'), tElementary('point2'), tElementary('point3')]}
          />
          <CategoryCard
            level="highSchool"
            title={tHighSchool('title')}
            items={[
              tHighSchool('point1'),
              tHighSchool('point2'),
              <>
                {tHighSchool.rich('point3', { strong: (chunks) => <strong>{chunks}</strong> })}{' '}
                <HelpTooltip
                  label={tHighSchool('title')}
                  content={<>{tHighSchool('selectionNote')}</>}
                />
              </>,
            ]}
          />
        </div>

        {/* International competitions */}
        <div>
          {/* The lead line */}
          <GuideText>{tGuide('sections.mathOlympiad.international.intro')}</GuideText>
          {/* The draws, as quick bullets */}
          <BulletList className="mt-4" items={internationalFeatures} />
          {/* Pointer to the cards, ending in an inline ⓘ that hints each opens to its details */}
          <GuideText variant="small" className="mt-4 mb-4 text-muted">
            {tGuide('sections.mathOlympiad.international.hint')}
          </GuideText>
          {/* One card per competition */}
          <DeckGrid>
            {GUIDE_CONTENT.internationalCompetitions.map((competition) => (
              <InternationalCard key={competition.id} competition={competition} />
            ))}
          </DeckGrid>
        </div>

        {/* MO tip */}
        <TipBox>{tGuide('sections.mathOlympiad.tip')}</TipBox>
      </div>
    </div>
  )
}
