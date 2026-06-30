/**
 * Validates guide content structure (src/content/guide.json):
 * - Required fields present; all entity ids unique (they double as DOM anchors)
 * - Every localized field has non-empty values for all supported locales
 * - Closed-union fields (level, country, kind, bucket) hold known values
 * - Descriptions are a valid discriminated union (text and rich both carry a localized string)
 * - Links are URLs/routes; several on a card each carry a chooser label, a lone link carries none
 * - Seminars carry at least one link (they always render as link cards)
 * - A description embedding an inline link sits on a static card only (else the prose anchor would
 *   nest inside the card's own whole-card link or button)
 *
 * Run with: npx tsx scripts/validate-guide.ts
 */

import fs from 'fs'
import path from 'path'

import {
  COMPETITION_KINDS,
  COUNTRIES,
  type GuideContent,
  type GuideDescription,
  type GuideLink,
  type GuideLinkLabel,
  RESOURCE_BUCKETS,
  RESOURCE_LEVELS,
  SCHOOL_LEVELS,
} from '../src/components/features/guide/content/guide-content-types'
import {
  validateLocalizedString,
  validateMembership,
  validateOptionalLink,
  validateRequiredArray,
  validateRequiredField,
  validateUniqueness,
} from '../src/lib/content-validation'
import { runValidator } from './validation-runner'

/** Path to guide.json */
const GUIDE_PATH = path.join(process.cwd(), 'src/content/guide.json')

/**
 * Validates a guide description (discriminated union): both `text` and `rich` carry a multilingual
 * string (rich is rendered as constrained MDX). Disallowed-tag safety is enforced at build by the
 * throwing MDX map (the news precedent), not here.
 *
 * @param description - The description to validate.
 * @param fieldName - The field name (for error messages).
 * @param context - The containing item (for error messages).
 *
 * @yields Errors for any failure.
 */
function* validateDescription(
  description: GuideDescription,
  fieldName: string,
  context: string
): Generator<string> {
  switch (description.kind) {
    case 'text':
    case 'rich':
      // Both kinds carry a multilingual string; it must be present in every locale
      yield* validateLocalizedString(description.value, fieldName, context)
      break

    default:
      // An unrecognized kind slipped past the untyped JSON
      yield `❌ Unknown ${fieldName} kind "${(description as { kind: string }).kind}" for ${context}`
  }
}

/**
 * Validates one chooser label (discriminated union): a country variant names a known country; a text
 * variant carries a fully-localized string.
 *
 * @param label - The link label to validate.
 * @param context - The containing item (for error messages).
 *
 * @yields Errors for an unknown country, a non-localized text, or an unrecognized kind.
 */
function* validateLinkLabel(label: GuideLinkLabel, context: string): Generator<string> {
  switch (label.kind) {
    // Country variant → a known country
    case 'country':
      yield* validateMembership(label.country, COUNTRIES, 'link label country', context)
      break

    // Text variant → a fully-localized string
    case 'text':
      yield* validateLocalizedString(label.value, 'link label text', context)
      break

    // An unrecognized kind slipped past the untyped JSON
    default:
      yield `❌ Unknown link label kind "${(label as { kind: string }).kind}" for ${context}`
  }
}

/**
 * Validates a card's official links and their chooser labels. Every url is a URL or internal route.
 * A card with several links is a chooser, so each link must carry a label; a lone link makes the
 * whole card navigate, so it must NOT carry a (never-rendered) label.
 *
 * @param links - The card's official links.
 * @param context - The containing item (for error messages).
 *
 * @yields Errors for a bad url, a missing chooser label, a stray lone-link label, or a bad label.
 */
function* validateLinks(links: GuideLink[], context: string): Generator<string> {
  // Several links make a chooser, which must label every link
  const labelsRequired = links.length > 1

  // Check each link's url and its label against the chooser rule
  for (const link of links) {
    // The url is an absolute URL or an internal route path
    yield* validateOptionalLink(link.url, 'link url', context)

    // A chooser link without a label would render as a bare url
    if (labelsRequired && !link.label) {
      yield `❌ Link "${link.url}" in ${context} needs a label (a multi-link card is a chooser)`
    }

    // A lone link's label never renders, so it's dead data
    if (!labelsRequired && link.label) {
      yield `❌ Link "${link.url}" in ${context} carries a label but isn't part of a chooser`
    }

    // Validate the label's own shape when present
    if (link.label) {
      yield* validateLinkLabel(link.label, context)
    }
  }
}

/** Matches an inline markdown link `[text](target)`. */
const MARKDOWN_LINK = /\[[^\]]+\]\([^)]+\)/

/**
 * Whether a description embeds an inline markdown link in any locale. Only rich prose can carry inline
 * markup, so plain text never matches.
 *
 * @param description - The description to inspect.
 *
 * @returns True when a rich description carries a link in some locale.
 */
function descriptionEmbedsLink(description: GuideDescription): boolean {
  // Scan every locale's markdown for an inline link
  return (
    description.kind === 'rich' &&
    Object.values(description.value).some((markdown) => MARKDOWN_LINK.test(markdown))
  )
}

/**
 * Validates the whole-card-link invariant: a description that embeds an inline link forces a static
 * card, because the card's prose would otherwise nest an anchor inside its own whole-card link or
 * button. So an interactive card (any official link, or detail bullets that grow a modal) must keep
 * its description link-free.
 *
 * @param description - The card's main description.
 * @param interactive - Whether the card renders as a whole-card link or button.
 * @param context - The containing item (for error messages).
 *
 * @yields An error when an interactive card embeds a link in its description.
 */
function* validateDescriptionLinkPlacement(
  description: GuideDescription,
  interactive: boolean,
  context: string
): Generator<string> {
  // An interactive card can't host a description link without nesting an anchor
  if (interactive && descriptionEmbedsLink(description)) {
    yield `❌ Description embeds a link but ${context} is a whole-card link/button; ` +
      `a description link is only allowed on a static card (no official link, no detail bullets).`
  }
}

/**
 * Validates the guide content, collecting every error.
 *
 * @returns Every validation error found; empty when valid.
 */
function validate(): string[] {
  // Collect errors here
  const errors: string[] = []

  // Ensure guide.json exists
  if (!fs.existsSync(GUIDE_PATH)) {
    // Bail with the single fatal error
    return ['❌ guide.json not found']
  }

  // Parse the guide content
  const content: GuideContent = JSON.parse(fs.readFileSync(GUIDE_PATH, 'utf-8'))

  // Gather every entity (ids must be globally unique — they become DOM anchors)
  const allEntities = [
    ...content.benefits,
    ...content.internationalCompetitions,
    ...content.otherCompetitions,
    ...content.seminars,
    ...content.resources,
    ...content.steps,
  ]
  errors.push(
    ...validateUniqueness(
      allEntities,
      (entity) => entity.id,
      (entity) => `guide entity "${entity.id}"`,
      'id'
    )
  )

  // Benefits
  for (const benefit of content.benefits) {
    const context = `benefit "${benefit.id}"`
    errors.push(...validateRequiredField(benefit.id, 'id', context))
    errors.push(...validateLocalizedString(benefit.title, 'title', context))
    errors.push(...validateLocalizedString(benefit.text, 'text', context))
  }

  // International competitions
  for (const competition of content.internationalCompetitions) {
    const context = `competition "${competition.id}"`
    errors.push(...validateRequiredField(competition.id, 'id', context))
    errors.push(...validateRequiredField(competition.acronym, 'acronym', context))
    errors.push(...validateRequiredField(competition.fullName, 'fullName', context))
    errors.push(...validateDescription(competition.description, 'description', context))
    // An official link or detail-bullet modal makes the card interactive, barring a description link
    const interactive = competition.links.length > 0 || competition.details.length > 0
    errors.push(...validateDescriptionLinkPlacement(competition.description, interactive, context))
    // Each detail bullet must be fully localized
    competition.details.forEach((detail, index) =>
      errors.push(...validateDescription(detail, `details[${index}]`, context))
    )
    // Official links, each a URL/route with a chooser-consistent label
    errors.push(...validateLinks(competition.links, context))
  }

  // Other competitions
  for (const competition of content.otherCompetitions) {
    const context = `competition "${competition.id}"`
    errors.push(...validateRequiredField(competition.id, 'id', context))
    errors.push(...validateLocalizedString(competition.title, 'title', context))
    errors.push(...validateDescription(competition.description, 'description', context))
    // Any official link makes the card interactive, barring a description link
    errors.push(
      ...validateDescriptionLinkPlacement(
        competition.description,
        competition.links.length > 0,
        context
      )
    )
    // Official links, each a URL/route with a chooser-consistent label
    errors.push(...validateLinks(competition.links, context))
    // Closed-union memberships
    for (const level of competition.levels) {
      errors.push(...validateMembership(level, SCHOOL_LEVELS, 'level', context))
    }
    for (const country of competition.countries) {
      errors.push(...validateMembership(country, COUNTRIES, 'country', context))
    }
    errors.push(...validateMembership(competition.kind, COMPETITION_KINDS, 'kind', context))
  }

  // Seminars
  for (const seminar of content.seminars) {
    const context = `seminar "${seminar.id}"`
    errors.push(...validateRequiredField(seminar.id, 'id', context))
    errors.push(...validateRequiredField(seminar.title, 'title', context))
    // A seminar is always a link card, so at least one link is mandatory
    errors.push(...validateRequiredArray(seminar.links, 'links', context))
    // Official links, each a URL/route with a chooser-consistent label
    errors.push(...validateLinks(seminar.links, context))
    errors.push(...validateMembership(seminar.level, SCHOOL_LEVELS, 'level', context))
    // A seminar runs in at least one country
    errors.push(...validateRequiredArray(seminar.countries, 'countries', context))
    // Each operating country is a known value
    for (const country of seminar.countries) {
      errors.push(...validateMembership(country, COUNTRIES, 'country', context))
    }
    // Optional description, but fully localized when present
    if (seminar.description) {
      errors.push(...validateDescription(seminar.description, 'description', context))
      // A seminar with links is interactive, so its description can't embed one
      errors.push(
        ...validateDescriptionLinkPlacement(seminar.description, seminar.links.length > 0, context)
      )
    }
  }

  // Resources
  for (const resource of content.resources) {
    const context = `resource "${resource.id}"`
    errors.push(...validateRequiredField(resource.id, 'id', context))
    errors.push(...validateLocalizedString(resource.title, 'title', context))
    errors.push(...validateMembership(resource.bucket, RESOURCE_BUCKETS, 'bucket', context))
    errors.push(...validateMembership(resource.level, RESOURCE_LEVELS, 'level', context))
    errors.push(...validateDescription(resource.description, 'description', context))
    // A lone official link makes the card a whole-card link, barring a description link
    errors.push(
      ...validateDescriptionLinkPlacement(resource.description, resource.links.length > 0, context)
    )
    // Official links, each a URL/route with a chooser-consistent label
    errors.push(...validateLinks(resource.links, context))
  }

  // Steps
  for (const step of content.steps) {
    const context = `step "${step.id}"`
    errors.push(...validateRequiredField(step.id, 'id', context))
    errors.push(...validateLocalizedString(step.title, 'title', context))
    step.points.forEach((point, index) =>
      errors.push(...validateLocalizedString(point, `points[${index}]`, context))
    )
  }

  // Hand back every collected error
  return errors
}

// Run the validator and exit with its status
runValidator(
  {
    validating: 'guide content',
    success: 'Guide content is valid!',
    failure: 'Guide validation failed.',
  },
  validate
)
