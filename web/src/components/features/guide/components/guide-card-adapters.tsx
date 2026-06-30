import { useLocale } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import type { Locale } from '@/i18n/i18n'

import { COMPETITION_KIND_COLORS, RESOURCE_BUCKET_COLORS } from '../content/guide-colors'
import type {
  InternationalCompetition,
  OtherCompetition,
  Resource,
  Seminar,
} from '../content/guide-content-types'
import { useGuideLabels } from '../content/guide-labels'
import { CountryBadge } from '../layout/CountryBadge'
import { SchoolLevels } from '../layout/SchoolLevels'
import { useGuideDeck } from './guide-deck-context'
import { resolveCardContent } from './guide-rich-description-map'
import { GuideCard } from './GuideCard'

/**
 * Props for the {@link InternationalCard} component.
 */
type InternationalCardProps = {
  /** The international competition. */
  competition: InternationalCompetition
}

/**
 * Fills a {@link GuideCard} for an international competition: the acronym titles the tile, the full
 * name rides beside it, and any detail bullets grow the card's modal.
 */
export function InternationalCard({ competition }: InternationalCardProps) {
  // The active locale
  const locale = useLocale() as Locale
  // The pre-rendered rich descriptions
  const { richDescriptions } = useGuideDeck()

  // The resolved description + detail-bullet nodes
  const { description, details } = resolveCardContent(
    competition.id,
    competition.description,
    competition.details,
    richDescriptions,
    locale
  )

  // Build the card from the competition's data
  return (
    <GuideCard
      id={competition.id}
      title={competition.acronym}
      aside={competition.fullName}
      description={description}
      details={details}
      links={competition.links}
    />
  )
}

/**
 * Props for the {@link OtherCard} component.
 */
type OtherCardProps = {
  /** The non-olympiad competition. */
  competition: OtherCompetition
}

/**
 * Fills a {@link GuideCard} for a non-olympiad competition. A single official link makes the whole
 * card navigable; several open the card's chooser modal.
 */
export function OtherCard({ competition }: OtherCardProps) {
  // The active locale
  const locale = useLocale() as Locale
  // Localized value labels
  const labels = useGuideLabels()
  // The pre-rendered rich descriptions
  const { richDescriptions } = useGuideDeck()

  // The resolved description node
  const { description } = resolveCardContent(
    competition.id,
    competition.description,
    [],
    richDescriptions,
    locale
  )

  // The meta line: kind carries the color, levels + countries stay plain
  const meta = (
    <>
      {/* Kind, the one colored token */}
      <span className={cn('font-semibold', COMPETITION_KIND_COLORS[competition.kind])}>
        {labels.kind[competition.kind]}
      </span>
      {/* School levels, when tagged */}
      {competition.levels.length > 0 && <SchoolLevels levels={competition.levels} />}
      {/* Country flags, when tagged */}
      {competition.countries.length > 0 && <CountryBadge countries={competition.countries} />}
    </>
  )

  // Build the card from the competition's data
  return (
    <GuideCard
      id={competition.id}
      title={competition.title[locale]}
      description={description}
      meta={meta}
      links={competition.links}
    />
  )
}

/**
 * Props for the {@link SeminarCard} component.
 */
type SeminarCardProps = {
  /** The correspondence seminar. */
  seminar: Seminar
}

/**
 * Fills a {@link GuideCard} for a correspondence seminar. A single official link makes the whole card
 * navigable; several open the card's chooser modal. A link-only seminar carries no description, so its
 * level + countries metadata leads the card.
 */
export function SeminarCard({ seminar }: SeminarCardProps) {
  // The active locale
  const locale = useLocale() as Locale
  // The pre-rendered rich descriptions
  const { richDescriptions } = useGuideDeck()

  // The resolved description node, or none when the seminar is link-only
  const description = seminar.description
    ? resolveCardContent(seminar.id, seminar.description, [], richDescriptions, locale).description
    : undefined

  // The meta line: school-level facet then country flags
  const meta = (
    <>
      <SchoolLevels levels={[seminar.level]} />
      <CountryBadge countries={seminar.countries} />
    </>
  )

  // Build the card from the seminar's data
  return (
    <GuideCard
      id={seminar.id}
      title={seminar.title}
      description={description}
      meta={meta}
      links={seminar.links}
    />
  )
}

/**
 * Props for the {@link ResourceCard} component.
 */
type ResourceCardProps = {
  /** The study/community resource. */
  resource: Resource
}

/**
 * Fills a {@link GuideCard} for a study/community resource. A lone official link makes the whole card
 * navigable; without one it stays a plain card whose description can host its own inline link.
 */
export function ResourceCard({ resource }: ResourceCardProps) {
  // The active locale
  const locale = useLocale() as Locale
  // Localized value labels
  const labels = useGuideLabels()
  // The pre-rendered rich descriptions
  const { richDescriptions } = useGuideDeck()

  // The resolved description node
  const { description } = resolveCardContent(
    resource.id,
    resource.description,
    [],
    richDescriptions,
    locale
  )

  // The meta line: the colored bucket name, qualified by the experience-level phrase
  const meta = (
    <span>
      {/* The colored bucket token */}
      <span className={cn('font-semibold', RESOURCE_BUCKET_COLORS[resource.bucket])}>
        {labels.bucket[resource.bucket]}
      </span>{' '}
      {/* The experience-level qualifier, set as an italic aside */}
      <span className="text-muted-foreground italic">
        {labels.resourceAudience[resource.level]}
      </span>
    </span>
  )

  // Build the card from the resource's data
  return (
    <GuideCard
      id={resource.id}
      title={resource.title[locale]}
      aside={resource.fullName}
      description={description}
      meta={meta}
      links={resource.links}
    />
  )
}
