import { invert } from '@/components/shared/utils/collection-utils'
import { invertByLocale, type Locale } from '@/i18n/i18n'

import {
  type CompetitionKind,
  GUIDE_PAGES,
  type GuidePage,
  type ResourceBucket,
  type ResourceLevel,
  type SchoolLevel,
} from './guide-content-types'
import { type FilterCountry, type GuideDeckState, type GuideFilters } from './guide-filters'

/**
 * Localized deep-link vocabulary for the guide deck: param keys and values are translated per
 * locale, with English as the canonical id space.
 */

/** The deck dimensions that can appear as a URL param: the page plus each filter facet. */
type ParamName = 'page' | keyof GuideFilters

/** Per-locale URL param keys; English is canonical. */
const PARAM_KEYS: Record<Locale, Record<ParamName, string>> = {
  en: {
    page: 'page',
    schoolLevel: 'level',
    kind: 'kind',
    country: 'country',
    bucket: 'bucket',
    resourceLevel: 'difficulty',
  },
  sk: {
    page: 'stranka',
    schoolLevel: 'uroven',
    kind: 'typ',
    country: 'krajina',
    bucket: 'kategoria',
    resourceLevel: 'obtiaznost',
  },
  cs: {
    page: 'stranka',
    schoolLevel: 'uroven',
    kind: 'typ',
    country: 'krajina',
    bucket: 'kategorie',
    resourceLevel: 'obtiznost',
  },
}

/** Per-locale tokens for the page value. */
const PAGE_TOKENS: Record<Locale, Record<GuidePage, string>> = {
  en: {
    why: 'why',
    olympiad: 'olympiad',
    other: 'other',
    seminars: 'seminars',
    resources: 'resources',
    getStarted: 'get-started',
  },
  sk: {
    why: 'preco',
    olympiad: 'olympiada',
    other: 'ostatne',
    seminars: 'seminare',
    resources: 'zdroje',
    getStarted: 'ako-zacat',
  },
  cs: {
    why: 'proc',
    olympiad: 'olympiada',
    other: 'ostatni',
    seminars: 'seminare',
    resources: 'zdroje',
    getStarted: 'jak-zacit',
  },
}

/** Per-locale tokens for the school-level value. */
const SCHOOL_LEVEL_TOKENS: Record<Locale, Record<SchoolLevel, string>> = {
  en: { elementary: 'elementary', highSchool: 'high-school' },
  sk: { elementary: 'zs', highSchool: 'ss' },
  cs: { elementary: 'zs', highSchool: 'ss' },
}

/** Per-locale tokens for the competition-kind value. */
const KIND_TOKENS: Record<Locale, Record<CompetitionKind, string>> = {
  en: { team: 'team', individual: 'individual' },
  sk: { team: 'timova', individual: 'individualna' },
  cs: { team: 'tymova', individual: 'individualni' },
}

/** Tokens for the country value — short codes, identical across locales. */
const COUNTRY_TOKENS: Record<FilterCountry, string> = {
  SK: 'sk',
  CZ: 'cz',
  PL: 'pl',
  INTERNATIONAL: 'int',
}

/** Per-locale tokens for the resource-bucket value. */
const BUCKET_TOKENS: Record<Locale, Record<ResourceBucket, string>> = {
  en: { websites: 'websites', programs: 'programs', youtube: 'youtube', studyTexts: 'texts' },
  sk: { websites: 'web', programs: 'nastroje', youtube: 'youtube', studyTexts: 'texty' },
  cs: { websites: 'web', programs: 'nastroje', youtube: 'youtube', studyTexts: 'texty' },
}

/** Per-locale tokens for the resource experience-level value. */
const RESOURCE_LEVEL_TOKENS: Record<Locale, Record<ResourceLevel, string>> = {
  en: { beginner: 'beginner', advanced: 'advanced' },
  sk: { beginner: 'zaciatocnik', advanced: 'pokrocily' },
  cs: { beginner: 'zacatecnik', advanced: 'pokrocily' },
}

// Token → id reverse lookups, precomputed once at module load since the token tables are static

/** Per-locale token → page-id lookup. */
const INVERTED_PAGE = invertByLocale(PAGE_TOKENS)

/** Per-locale token → school-level-id lookup. */
const INVERTED_SCHOOL_LEVEL = invertByLocale(SCHOOL_LEVEL_TOKENS)

/** Per-locale token → competition-kind-id lookup. */
const INVERTED_KIND = invertByLocale(KIND_TOKENS)

/** Per-locale token → resource-bucket-id lookup. */
const INVERTED_BUCKET = invertByLocale(BUCKET_TOKENS)

/** Per-locale token → resource-level-id lookup. */
const INVERTED_RESOURCE_LEVEL = invertByLocale(RESOURCE_LEVEL_TOKENS)

/** Token → country-id lookup (country tokens are locale-independent). */
const INVERTED_COUNTRY = invert(COUNTRY_TOKENS)

/**
 * Decodes the deck state from URL search params for a locale, dropping anything unrecognized
 * to a sensible default rather than erroring.
 *
 * @param params - The URL search params.
 * @param locale - The active locale whose token vocabulary applies.
 *
 * @returns The resolved page and its filter selections.
 */
export function decodeDeckState(params: URLSearchParams, locale: Locale): GuideDeckState {
  // Resolve the localized param keys for this locale
  const keys = PARAM_KEYS[locale]

  // Decode the page, defaulting to the first page when absent/unknown
  const page = INVERTED_PAGE[locale].get(params.get(keys.page) ?? '') ?? GUIDE_PAGES[0]

  // Decode each single-select filter, dropping unknown tokens to null
  const filters: GuideFilters = {
    schoolLevel: INVERTED_SCHOOL_LEVEL[locale].get(params.get(keys.schoolLevel) ?? '') ?? null,
    kind: INVERTED_KIND[locale].get(params.get(keys.kind) ?? '') ?? null,
    country: INVERTED_COUNTRY.get(params.get(keys.country) ?? '') ?? null,
    bucket: INVERTED_BUCKET[locale].get(params.get(keys.bucket) ?? '') ?? null,
    resourceLevel:
      INVERTED_RESOURCE_LEVEL[locale].get(params.get(keys.resourceLevel) ?? '') ?? null,
  }

  // Hand back the resolved view
  return { page, filters }
}

/**
 * Encodes the deck state into a localized query string. The default page and null filters are
 * omitted, so a pristine view yields an empty string (a bare URL).
 *
 * @param state - The deck view to encode.
 * @param locale - The active locale whose token vocabulary applies.
 *
 * @returns The query string without a leading `?`, or an empty string when pristine.
 */
export function encodeDeckState(state: GuideDeckState, locale: Locale): string {
  // Resolve the localized param keys for this locale
  const keys = PARAM_KEYS[locale]

  // Encode each set filter to its localized `key=token` pair, null when unset. Typing this as a
  // record over every filter facet makes a newly added filter a compile error until handled here.
  const filterParts: Record<keyof GuideFilters, string | null> = {
    schoolLevel:
      state.filters.schoolLevel &&
      `${keys.schoolLevel}=${SCHOOL_LEVEL_TOKENS[locale][state.filters.schoolLevel]}`,
    kind: state.filters.kind && `${keys.kind}=${KIND_TOKENS[locale][state.filters.kind]}`,
    country: state.filters.country && `${keys.country}=${COUNTRY_TOKENS[state.filters.country]}`,
    bucket: state.filters.bucket && `${keys.bucket}=${BUCKET_TOKENS[locale][state.filters.bucket]}`,
    resourceLevel:
      state.filters.resourceLevel &&
      `${keys.resourceLevel}=${RESOURCE_LEVEL_TOKENS[locale][state.filters.resourceLevel]}`,
  }

  // Lead with the page, but only when it isn't the default first page
  const pagePart =
    state.page === GUIDE_PAGES[0] ? null : `${keys.page}=${PAGE_TOKENS[locale][state.page]}`

  // Drop the unset entries and join the rest into a query string
  return [pagePart, ...Object.values(filterParts)]
    .filter((part): part is string => part !== null)
    .join('&')
}

/**
 * Re-expresses a guide query string from one locale's token vocabulary into another's. The deck's
 * deep-link keys and values are localized, so a query authored under `from` is gibberish to a
 * `to`-locale decoder until round-tripped: decode with the source vocabulary, re-encode with
 * the target's. A pristine view round-trips to an empty string.
 *
 * @param params - The guide query carrying the source locale's tokens.
 * @param from - The locale whose vocabulary `params` is written in.
 * @param to - The locale whose vocabulary the result should use.
 *
 * @returns The re-encoded query string without a leading `?`, or an empty string when pristine.
 */
export function translateGuideSearchParams(
  params: URLSearchParams,
  from: Locale,
  to: Locale
): string {
  // Decode under the source vocabulary, then re-encode under the target's
  return encodeDeckState(decodeDeckState(params, from), to)
}

/**
 * The guide renders as a slideshow ("deck") of {@link GUIDE_PAGES}. Authored markdown can't express
 * "slide to another page", so an href of the bare form `#<page>` (a real page id after the hash) is
 * treated as a signal to jump the deck rather than as a normal anchor — that special href is the
 * sentinel. Any other `#fragment`, internal path, or external URL is left as an ordinary link.
 *
 * @param href - The link target from the authored markdown.
 *
 * @returns The deck page to slide to, or null when the href is an ordinary link.
 */
export function parseDeckSentinel(href: string): GuidePage | null {
  // Bail on anything that isn't a `#`-fragment
  if (!href.startsWith('#')) return null
  // The fragment after the hash
  const token = href.slice(1)
  // Only a real page id drives the deck; any other fragment stays a normal anchor
  return (GUIDE_PAGES as readonly string[]).includes(token) ? (token as GuidePage) : null
}
