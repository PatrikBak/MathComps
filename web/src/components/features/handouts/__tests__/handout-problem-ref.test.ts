import { describe, expect, it, vi } from 'vitest'

import type { HandoutMetadata } from '../handout-metadata-types'
import { resolveHandoutProblemRef } from '../handout-problem-ref'

/**
 * A fixture handout index: one fully-localized handout, and one published in Czech alone, so the resolver's
 * lookup and locale handling can be tested against known data rather than the real content file.
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

/**
 * A fixture environment index, matching the two handouts above plus one entry naming a handout the site no
 * longer has, to exercise the drift case a stale index would produce.
 */
vi.mock('@/content/handout-env-index.json', () => ({
  default: {
    'AbC-123': {
      'three-numbers-am-gm': { type: 'problem', number: 4 },
      'am-gm-two-numbers': { type: 'theorem', number: 1 },
    },
    CzechOnly: {
      'first-proof': { type: 'problem', number: 1 },
    },
    GoneFromIndex: {
      orphan: { type: 'problem', number: 1 },
    },
  },
}))

describe('resolveHandoutProblemRef', () => {
  it('resolves the title, type, number, slug, and anchor for the default locale', () => {
    // A problem in the fully-localized fixture handout, in English
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'AbC-123', environmentId: 'three-numbers-am-gm' },
      'en'
    )

    // The English title and slug, with the problem's placement and anchor
    expect(ref).toEqual({
      handoutTitle: 'Means',
      environmentType: 'problem',
      environmentNumber: 4,
      handoutSlug: 'means',
      anchorId: 'env-three-numbers-am-gm',
    })
  })

  it('names a handout published in another language, but offers no page in this one', () => {
    // A Czech-only handout, asked for in Slovak
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'CzechOnly', environmentId: 'first-proof' },
      'sk'
    )

    // It still names itself from the language it has, but there's no Slovak page to link to
    expect(ref).toEqual({
      handoutTitle: 'Základy důkazů',
      environmentType: 'problem',
      environmentNumber: 1,
      handoutSlug: null,
      anchorId: 'env-first-proof',
    })
  })

  it('uses the localized title and slug for a non-default locale', () => {
    // The same problem, in Slovak
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'AbC-123', environmentId: 'three-numbers-am-gm' },
      'sk'
    )

    // The Slovak title and slug, with the same locale-stable anchor
    expect(ref).toEqual({
      handoutTitle: 'Priemery',
      environmentType: 'problem',
      environmentNumber: 4,
      handoutSlug: 'priemery',
      anchorId: 'env-three-numbers-am-gm',
    })
  })

  it('links to the page in the one language a handout is published in', () => {
    // The Czech-only handout, asked for in its own language
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'CzechOnly', environmentId: 'first-proof' },
      'cs'
    )

    // Czech has a page, so the slug is there to link with
    expect(ref?.handoutSlug).toBe('dukazy')
  })

  it('returns null when the handout is unknown', () => {
    // A content id that isn't in the index
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'missing', environmentId: 'three-numbers-am-gm' },
      'en'
    )

    // Nothing to resolve
    expect(ref).toBeNull()
  })

  it('returns null for an environment that is no longer in its handout', () => {
    // An environment id the real handout doesn't carry — a deleted or renamed environment, rather than a
    // confidently-wrong row
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'AbC-123', environmentId: 'deleted-environment' },
      'en'
    )

    // Nothing to resolve
    expect(ref).toBeNull()
  })

  it('returns null when the environment index names a handout the site no longer has', () => {
    // The environment index and the handout index have drifted apart
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'GoneFromIndex', environmentId: 'orphan' },
      'en'
    )

    // Nothing to resolve
    expect(ref).toBeNull()
  })
})
