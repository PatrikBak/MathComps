import type { LocalizedString } from '@/i18n/i18n'

/**
 * The guide content model: one multilingual record per entity. Presentation (icons, accents, layout)
 * lives in code, not here.
 */

/** School levels in canonical display order. */
export const SCHOOL_LEVELS = ['elementary', 'highSchool'] as const

/** A school level an entity can target. */
export type SchoolLevel = (typeof SCHOOL_LEVELS)[number]

/**
 * Every taggable country, in canonical display order, mapped to its ISO 3166 flag code. The single
 * source of truth for both the {@link Country} type and the {@link COUNTRIES} list.
 */
export const COUNTRY_FLAG_CODES = {
  SK: 'sk',
  CZ: 'cz',
  PL: 'pl',
  EN: 'gb',
  INTERNATIONAL: 'un',
} as const satisfies Record<string, string>

/** A country an entity can be tagged with. */
export type Country = keyof typeof COUNTRY_FLAG_CODES

/** Countries in canonical display order. */
export const COUNTRIES = Object.keys(COUNTRY_FLAG_CODES) as Country[]

/** Competition kinds in canonical display order. */
export const COMPETITION_KINDS = ['team', 'individual'] as const

/** Whether a competition is solved as a team or individually. */
export type CompetitionKind = (typeof COMPETITION_KINDS)[number]

/** Resource buckets in canonical display order. */
export const RESOURCE_BUCKETS = ['websites', 'programs', 'youtube', 'studyTexts'] as const

/** Which category a resource belongs to. */
export type ResourceBucket = (typeof RESOURCE_BUCKETS)[number]

/** Resource experience levels in canonical display order (beginner-friendly first). */
export const RESOURCE_LEVELS = ['beginner', 'advanced'] as const

/** The experience level a resource best suits. */
export type ResourceLevel = (typeof RESOURCE_LEVELS)[number]

/** The deck pages in canonical order. */
export const GUIDE_PAGES = [
  'why',
  'olympiad',
  'other',
  'seminars',
  'resources',
  'getStarted',
] as const

/** A single page of the guide deck. */
export type GuidePage = (typeof GUIDE_PAGES)[number]

/**
 * A plain-text description.
 */
type GuideDescriptionText = {
  /** Tag for the plain-text variant. */
  kind: 'text'
  /** The multilingual prose. */
  value: LocalizedString
}

/**
 * A rich description carrying inline markup (anchors, no-break spans).
 */
type GuideDescriptionRich = {
  /** Tag for the rich variant. */
  kind: 'rich'
  /** The multilingual inline markdown. */
  value: LocalizedString
}

/** A guide blurb: plain inline text, or rich prose. */
export type GuideDescription = GuideDescriptionText | GuideDescriptionRich

/**
 * A link label naming a national variant: a flag plus the localized country name.
 */
type GuideLinkLabelCountry = {
  /** Tag for the country-variant label. */
  kind: 'country'
  /** The country this variant belongs to. */
  country: Country
}

/**
 * A link label with authored localized text, for a variant a country can't name — an audience or a
 * sub-competition (e.g. "Maksík", "High school").
 */
type GuideLinkLabelText = {
  /** Tag for the free-text label. */
  kind: 'text'
  /** The multilingual label text. */
  value: LocalizedString
}

/** How one link is labeled when a card offers a choice of several. */
export type GuideLinkLabel = GuideLinkLabelCountry | GuideLinkLabelText

/**
 * One official link. Several on a card become a labeled chooser; a lone link makes the whole card
 * navigate, so it needs no label.
 */
export type GuideLink = {
  /** An absolute http(s) URL, or an internal route path starting with `/`. */
  url: string
  /** The chooser label; present only when a card offers several links. */
  label?: GuideLinkLabel
}

/**
 * A reason to do competition math.
 */
type Benefit = {
  /** A stable unique id. */
  id: string
  /** Benefit heading. */
  title: LocalizedString
  /** Benefit body. */
  text: LocalizedString
}

/**
 * One of the international olympiad-track competitions (IMO, MEMO, EGMO, CAPS, CPSJ).
 */
export type InternationalCompetition = {
  /** A stable unique id (e.g. `imo`). */
  id: string
  /** A short literal name (e.g. "IMO"). */
  acronym: string
  /** The full English name. */
  fullName: string
  /** Official links (typically just the homepage). */
  links: GuideLink[]
  /** One-line description. */
  description: GuideDescription
  /** Detail bullets, each a complete multilingual blurb. */
  details: GuideDescription[]
}

/**
 * A non-olympiad competition (Náboj, Math Kangaroo, …).
 */
export type OtherCompetition = {
  /** A stable unique id. */
  id: string
  /** Competition title. */
  title: LocalizedString
  /** One-line description. */
  description: GuideDescription
  /** Official links; a competition can have several (e.g. national variants). */
  links: GuideLink[]
  /** School levels the competition targets. */
  levels: SchoolLevel[]
  /** Countries where the competition runs. */
  countries: Country[]
  /** Whether it is a team or individual competition. */
  kind: CompetitionKind
}

/**
 * A correspondence seminar.
 */
export type Seminar = {
  /** A stable unique id. */
  id: string
  /** Literal proper-noun name (e.g. "KMS"). */
  title: string
  /** Official links; a seminar can have several (e.g. national variants). */
  links: GuideLink[]
  /** Target school level. */
  level: SchoolLevel
  /** Countries the seminar operates in. */
  countries: Country[]
  /** An optional description. */
  description?: GuideDescription
}

/**
 * A study/community resource.
 */
export type Resource = {
  /** A stable unique id. */
  id: string
  /** Resource title. */
  title: LocalizedString
  /** An optional expanded name (e.g. "Art of Problem Solving"). */
  fullName?: string
  /** Official links, if any. */
  links: GuideLink[]
  /** A description, either plain inline text or rich prose. */
  description: GuideDescription
  /** Which category this resource belongs to. */
  bucket: ResourceBucket
  /** The experience level the resource best suits. */
  level: ResourceLevel
}

/**
 * A getting-started step.
 */
type GuideStep = {
  /** A stable unique id. */
  id: string
  /** Step heading. */
  title: LocalizedString
  /** Ordered bullet points. */
  points: LocalizedString[]
}

/**
 * The root of the guide content: every entity array.
 */
export type GuideContent = {
  /** "Why competitions?" benefits. */
  benefits: Benefit[]
  /** International olympiad-track competitions. */
  internationalCompetitions: InternationalCompetition[]
  /** Other (non-olympiad) competitions. */
  otherCompetitions: OtherCompetition[]
  /** Correspondence seminars. */
  seminars: Seminar[]
  /** Study/community resources. */
  resources: Resource[]
  /** "How to start" steps. */
  steps: GuideStep[]
}
