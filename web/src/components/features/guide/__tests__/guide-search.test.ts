import { describe, expect, it } from 'vitest'

import { buildGuideSearchIndex, makeGuideFuse, searchGuide } from '../components/guide-search'
import { GUIDE_CONTENT } from '../content/guide-content'
import type { GuideContent } from '../content/guide-content-types'
import type { GuideLabels } from '../content/guide-labels'
import { type TileBehavior, tileBehavior } from '../content/guide-tile-behavior'

/** A localized blurb in all three languages. */
const text = (value: string) => ({
  kind: 'text' as const,
  value: { en: value, sk: value, cs: value },
})

/** A fixed content fixture exercising every behavior + locale path (never the real guide.json). */
const CONTENT: GuideContent = {
  benefits: [],
  steps: [],
  internationalCompetitions: [
    {
      id: 'imo',
      acronym: 'IMO',
      fullName: 'International Mathematical Olympiad',
      description: text('the most prestigious olympiad'),
      details: [text('6 best solvers')],
      links: [{ url: 'https://imo.example' }],
    },
  ],
  otherCompetitions: [
    {
      id: 'naboj',
      title: { en: 'Náboj', sk: 'Náboj', cs: 'Náboj' },
      description: text('a popular team competition'),
      links: [{ url: 'https://a.example' }, { url: 'https://b.example' }],
      levels: ['highSchool'],
      countries: ['CZ', 'SK'],
      kind: 'team',
    },
  ],
  seminars: [
    {
      id: 'kms',
      title: 'KMS',
      links: [{ url: 'https://kms.example' }],
      level: 'highSchool',
      countries: ['SK'],
    },
  ],
  resources: [
    {
      id: 'evanchen',
      title: { en: 'Evan Chen', sk: 'Evan Chen', cs: 'Evan Chen' },
      fullName: 'Evan Chen — Olympiad Resources',
      links: [{ url: 'https://evanchen.cc' }],
      description: text('a world-famous olympiad expert'),
      bucket: 'websites',
      level: 'advanced',
    },
    {
      id: 'ourMaterials',
      title: { en: 'Our materials', sk: 'Naše materiály', cs: 'Naše materiály' },
      links: [{ url: '/handouts' }],
      description: text('our own handouts'),
      bucket: 'studyTexts',
      level: 'beginner',
    },
    {
      id: 'mods',
      title: { en: 'MODS', sk: 'MODS', cs: 'MODS' },
      links: [],
      description: text('a discord community'),
      bucket: 'websites',
      level: 'advanced',
    },
  ],
}

/** A complete label fixture; only kind/bucket/schoolLevel feed the index, but the type wants them all. */
const LABELS: GuideLabels = {
  page: {
    why: 'Why',
    olympiad: 'Olympiad',
    other: 'Other',
    seminars: 'Seminars',
    resources: 'Resources',
    getStarted: 'Start',
  },
  kind: { team: 'Team', individual: 'Individual' },
  bucket: { websites: 'Web', programs: 'Tool', youtube: 'YouTube', studyTexts: 'Handout' },
  resourceLevel: { beginner: 'Beginner', advanced: 'Advanced' },
  resourceAudience: { beginner: 'for beginners', advanced: 'for the advanced' },
  schoolLevel: { elementary: 'ES', highSchool: 'HS' },
  country: { SK: 'Slovakia', CZ: 'Czechia', PL: 'Poland', INTERNATIONAL: 'International' },
}

/** Build the fixture index in English. */
const index = () => buildGuideSearchIndex('en', LABELS, CONTENT)

/** Look an entry up by id (it must exist in the fixture). */
const byId = (id: string) => {
  // Look up the entry by id
  const entry = index().find((candidate) => candidate.id === id)
  // It must exist — fail loudly so callers get a non-null value
  if (!entry) throw new Error(`fixture entry ${id} missing`)
  // Hand back the guaranteed-present entry
  return entry
}

describe('tileBehavior', () => {
  // The content-count thresholds, one row per branch boundary that matters
  it('classifies each content shape at its threshold', () => {
    // [detailCount, linkCount] → expected behavior across every boundary
    const cases: [number, number, TileBehavior][] = [
      [0, 0, 'static'], // nothing to show stays a plain card
      [0, 1, 'link'], // a lone link makes the whole tile navigate
      [0, 2, 'modal'], // several links grow a chooser modal
      [1, 0, 'modal'], // any detail bullet grows a modal
    ]
    // Each shape lands on its expected behavior
    for (const [detailCount, linkCount, expected] of cases) {
      expect(tileBehavior(detailCount, linkCount)).toBe(expected)
    }
  })
})

describe('buildGuideSearchIndex', () => {
  // Page is implicit in the source array
  it('maps each entity to its page', () => {
    // Build the fixture index
    const entries = index()
    // Each lands on the expected page
    expect(byId('imo').page).toBe('olympiad')
    expect(byId('naboj').page).toBe('other')
    expect(byId('kms').page).toBe('seminars')
    expect(byId('evanchen').page).toBe('resources')
    // Every entity is indexed
    expect(entries).toHaveLength(6)
  })

  // Titles + descriptions resolve to the active locale
  it('resolves localized fields', () => {
    // Find ourMaterials in the Slovak index
    const skEntry = buildGuideSearchIndex('sk', LABELS, CONTENT).find(
      (candidate) => candidate.id === 'ourMaterials'
    )
    // The Slovak title comes through
    expect(skEntry?.title).toBe('Naše materiály')
  })

  // Behavior + link target are precomputed from the content shape
  it('classifies behavior and resolves the lone link', () => {
    // Look up the external single-link resource
    const evan = byId('evanchen')
    // It classifies as a navigating link
    expect(evan.behavior).toBe('link')
    // Narrow to the link shape
    if (evan.behavior === 'link') {
      // It is external and carries its href
      expect(evan.isExternal).toBe(true)
      expect(evan.href).toBe('https://evanchen.cc')
    }
    // Look up the internal single-link resource
    const materials = byId('ourMaterials')
    // Narrow to the link shape
    if (materials.behavior === 'link') {
      // It points inward, so it is not external
      expect(materials.isExternal).toBe(false)
      expect(materials.href).toBe('/handouts')
    }
    // No links is static; bullets or several links are modal
    expect(byId('mods').behavior).toBe('static')
    expect(byId('imo').behavior).toBe('modal')
    expect(byId('naboj').behavior).toBe('modal')
  })

  // The subtitle composes the entity's quiet context tokens, one shape per page
  it('composes subtitles', () => {
    // International competition: the full name stands alone
    expect(byId('imo').subtitle).toBe('International Mathematical Olympiad')
    // Other competition: kind then country codes
    expect(byId('naboj').subtitle).toBe('Team · CZ · SK')
    // Seminar: level then country code
    expect(byId('kms').subtitle).toBe('HS · SK')
    // Resource with a full name: the full name wins
    expect(byId('evanchen').subtitle).toBe('Evan Chen — Olympiad Resources')
    // Resource without a full name: falls back to the bucket label
    expect(byId('mods').subtitle).toBe('Web')
  })

  // A link-only seminar carries no description; its subtitle metadata stands in
  it('leaves a link-only seminar without a description', () => {
    // KMS has no description in the fixture
    const kms = byId('kms')
    // Its description stays absent
    expect(kms.description).toBeUndefined()
  })
})

describe('searchGuide', () => {
  // A blank query matches nothing — our own guard, not Fuse's
  it('returns nothing for a blank query', () => {
    // Search a whitespace-only query
    const results = searchGuide(makeGuideFuse(index()), '   ')
    // The trim guard short-circuits before Fuse ever runs
    expect(results).toHaveLength(0)
  })
})

describe('over the real guide content', () => {
  // Every supported locale, so a description authored only in one language can't hide
  const locales = ['en', 'sk', 'cs'] as const

  // The builder maps every real entity across the four card-bearing pages, dropping none
  it('indexes every entity without throwing', () => {
    // The English index over the live entities
    const realIndex = buildGuideSearchIndex('en', LABELS, GUIDE_CONTENT)
    // The combined size of the four source arrays
    const total =
      GUIDE_CONTENT.internationalCompetitions.length +
      GUIDE_CONTENT.otherCompetitions.length +
      GUIDE_CONTENT.seminars.length +
      GUIDE_CONTENT.resources.length
    // The index carries exactly one entry per source entity
    expect(realIndex).toHaveLength(total)
  })

  // The resolver strips inline markdown from every authored description, in every locale
  it('leaves no inline markdown in any resolved description', () => {
    // A surviving `[text](url)` link in a resolved description
    const markdownLink = /\[[^\]]+\]\([^)]*\)/
    // Entries (locale-tagged for a readable failure) whose description kept an un-stripped token
    const leaked = locales.flatMap((locale) =>
      buildGuideSearchIndex(locale, LABELS, GUIDE_CONTENT)
        .filter((entry) => {
          // A metadata-only entity has no description to leak
          const description = entry.description ?? ''
          // Either an un-stripped markdown link or a leftover NoWrap tag is a leak
          return markdownLink.test(description) || /<\/?NoWrap/.test(description)
        })
        .map((entry) => `${locale}:${entry.id}`)
    )
    // None survive the strip
    expect(leaked).toEqual([])
  })
})
