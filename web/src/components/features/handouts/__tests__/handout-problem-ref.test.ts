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
      V8pQ2mZxK7nLrT4wYc1Db: {
        type: 'problem',
        number: 4,
        slug: { en: 'three-numbers-mean', sk: 'priemer-troch-cisel', cs: 'prumer-tri-cisel' },
      },
      Rt6yH1sD9kL0pZxCvB3nM: {
        type: 'theorem',
        number: 1,
        slug: { en: 'mean-of-two-numbers', sk: 'priemer-dvoch-cisel', cs: 'prumer-dvou-cisel' },
      },
    },
    CzechOnly: {
      Nb4wK8mQ2xR7tY1uZ5aJc: { type: 'problem', number: 1, slug: { cs: 'prvni-dukaz' } },
    },
    GoneFromIndex: {
      Gx3vT9pL6nW2sB8dF4hKq: { type: 'problem', number: 1, slug: { en: 'orphan' } },
    },
  },
}))

describe('resolveHandoutProblemRef', () => {
  it('resolves the title, type, number, slug, and anchor for the default locale', () => {
    // A problem in the fully-localized fixture handout, in English
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'AbC-123', environmentId: 'V8pQ2mZxK7nLrT4wYc1Db' },
      'en'
    )

    // The English title and slug, with the problem's placement and its English anchor
    expect(ref).toEqual({
      handoutTitle: 'Means',
      environmentType: 'problem',
      environmentNumber: 4,
      link: {
        handoutSlug: 'means',
        anchorId: 'env-three-numbers-mean',
        href: '/handouts/means#env-three-numbers-mean',
      },
    })
  })

  it('names a handout published in another language, but offers no page in this one', () => {
    // A Czech-only handout, asked for in Slovak
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'CzechOnly', environmentId: 'Nb4wK8mQ2xR7tY1uZ5aJc' },
      'sk'
    )

    // It still names itself from the language it has, but there's no Slovak page to link to
    expect(ref).toEqual({
      handoutTitle: 'Základy důkazů',
      environmentType: 'problem',
      environmentNumber: 1,
      link: null,
    })
  })

  it('uses the localized title, slug, and anchor for a non-default locale', () => {
    // The same problem, in Slovak
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'AbC-123', environmentId: 'V8pQ2mZxK7nLrT4wYc1Db' },
      'sk'
    )

    // Slovak names the handout, the page, and the environment its own way
    expect(ref).toEqual({
      handoutTitle: 'Priemery',
      environmentType: 'problem',
      environmentNumber: 4,
      link: {
        handoutSlug: 'priemery',
        anchorId: 'env-priemer-troch-cisel',
        href: '/materialy/priemery#env-priemer-troch-cisel',
      },
    })
  })

  it('links to the page in the one language a handout is published in', () => {
    // The Czech-only handout, asked for in its own language
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'CzechOnly', environmentId: 'Nb4wK8mQ2xR7tY1uZ5aJc' },
      'cs'
    )

    // Czech has a page, so there is a link to make
    expect(ref?.link).toEqual({
      handoutSlug: 'dukazy',
      anchorId: 'env-prvni-dukaz',
      href: '/materialy/dukazy#env-prvni-dukaz',
    })
  })

  it('returns null when the handout is unknown', () => {
    // A handout id the environment index carries nothing at all for
    const ref = resolveHandoutProblemRef(
      { handoutContentId: 'missing', environmentId: 'Nb4wK8mQ2xR7tY1uZ5aJc' },
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
      { handoutContentId: 'GoneFromIndex', environmentId: 'Gx3vT9pL6nW2sB8dF4hKq' },
      'en'
    )

    // Nothing to resolve
    expect(ref).toBeNull()
  })
})
