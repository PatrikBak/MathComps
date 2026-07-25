import { describe, expect, it, vi } from 'vitest'

import { HANDOUT_ENVIRONMENT_TYPES } from './handout-content-types'
import type { HandoutMetadata } from './handout-metadata-types'
import {
  buildHandoutProblemKey,
  parseHandoutProblemKey,
  resolveHandoutProblemRef,
} from './handout-problem-ref'

/**
 * A fixture handout index: one fully-localized handout, and one published in Czech alone, so the resolver's
 * lookup and locale handling can be tested against known data rather than the real content file. Each entry is a
 * whole {@link HandoutMetadata}, not the subset today's resolver happens to read. The factory is hoisted, so it
 * can hold no outer references.
 */
vi.mock('@/content/handouts.json', () => {
  // What every handout carries beyond its identity
  const common = {
    description: { en: 'A handout.', sk: 'Materiál.', cs: 'Materiál.' },
    difficulty: 1,
    authors: ['Patrik Bak'],
    publishedAt: '2026-01-01',
    updatedAt: '2026-01-01',
  } satisfies Partial<HandoutMetadata>

  // Both fixture handouts, under one category. Left unannotated on purpose: the index's declared LocalizedString
  // promises a value per locale, while a handout published in one language really carries only that one.
  const sections = [
    {
      categoryKey: 'algebra',
      category: { en: 'Algebra', sk: 'Algebra', cs: 'Algebra' },
      handouts: [
        {
          // A content id that itself contains hyphens, to catch greedy parsing
          id: 'AbC-123',
          slug: { en: 'means', sk: 'priemery', cs: 'prumery' },
          title: { en: 'Means', sk: 'Priemery', cs: 'Průměry' },
          ...common,
        },
        {
          id: 'CzechOnly',
          languages: ['cs'],
          slug: { cs: 'dukazy' },
          title: { cs: 'Základy důkazů' },
          ...common,
        },
      ],
    },
  ]

  // The index as the module exports it
  return { default: { sections } }
})

describe('buildHandoutProblemKey', () => {
  it.each(HANDOUT_ENVIRONMENT_TYPES)('round-trips a %s key through the parser', (type) => {
    // A key built for this environment type, over a content id that itself contains hyphens
    const key = buildHandoutProblemKey('AbC-123', type, 7)

    // Parsing it recovers exactly what was built
    expect(parseHandoutProblemKey(key)).toEqual({
      contentId: 'AbC-123',
      environmentType: type,
      environmentNumber: 7,
    })
  })
})

describe('parseHandoutProblemKey', () => {
  it('keeps hyphens inside the content id by anchoring on the trailing type and number', () => {
    // A content id with several hyphens
    const parsed = parseHandoutProblemKey('handout:a-b-c-theorem-2')

    // Everything up to the trailing -type-number is the content id
    expect(parsed).toEqual({ contentId: 'a-b-c', environmentType: 'theorem', environmentNumber: 2 })
  })

  it('parses when the content id looks like a type word', () => {
    // A content id that is literally "problem"
    const parsed = parseHandoutProblemKey('handout:problem-problem-3')

    // The trailing type and number are taken, not the leading look-alike
    expect(parsed).toEqual({
      contentId: 'problem',
      environmentType: 'problem',
      environmentNumber: 3,
    })
  })

  it.each([
    ['a non-handout source', 'catalog:x-problem-1'],
    ['a missing prefix', 'AbC-123-problem-1'],
    ['an unknown environment type', 'handout:x-lemma-1'],
    ['a missing number', 'handout:x-problem'],
    ['a non-numeric trailer', 'handout:x-problem-1x'],
  ])('returns null for %s', (_case, key) => {
    // A key that doesn't match the fixed shape
    const parsed = parseHandoutProblemKey(key)

    // Nothing parses
    expect(parsed).toBeNull()
  })
})

describe('resolveHandoutProblemRef', () => {
  it('resolves the title, slug, and anchor for the default locale', () => {
    // A problem in the fully-localized fixture handout, in English
    const ref = resolveHandoutProblemRef('handout:AbC-123-problem-4', 'en')

    // The English title and slug, with the problem's anchor
    expect(ref).toEqual({
      handoutTitle: 'Means',
      environmentType: 'problem',
      environmentNumber: 4,
      handoutSlug: 'means',
      anchorId: 'env-problem-4',
    })
  })

  it('names a handout published in another language, but offers no page in this one', () => {
    // A Czech-only handout, asked for in Slovak
    const ref = resolveHandoutProblemRef('handout:CzechOnly-problem-1', 'sk')

    // It still names itself from the language it has, but there's no Slovak page to link to
    expect(ref).toEqual({
      handoutTitle: 'Základy důkazů',
      environmentType: 'problem',
      environmentNumber: 1,
      handoutSlug: null,
      anchorId: 'env-problem-1',
    })
  })

  it('uses the localized title and slug for a non-default locale', () => {
    // The same problem, in Slovak
    const ref = resolveHandoutProblemRef('handout:AbC-123-problem-4', 'sk')

    // The Slovak title and slug, with the same locale-stable anchor
    expect(ref).toEqual({
      handoutTitle: 'Priemery',
      environmentType: 'problem',
      environmentNumber: 4,
      handoutSlug: 'priemery',
      anchorId: 'env-problem-4',
    })
  })

  it('returns null when the handout is unknown', () => {
    // A content id that isn't in the index
    const ref = resolveHandoutProblemRef('handout:missing-problem-1', 'en')

    // Nothing to resolve
    expect(ref).toBeNull()
  })

  it('links to the page in the one language a handout is published in', () => {
    // The Czech-only handout, asked for in its own language
    const ref = resolveHandoutProblemRef('handout:CzechOnly-problem-1', 'cs')

    // Czech has a page, so the slug is there to link with
    expect(ref?.handoutSlug).toBe('dukazy')
  })
})
