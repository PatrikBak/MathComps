import { describe, expect, it, vi } from 'vitest'

import type { HandoutMetadata } from '../handout-metadata-types'
import { describeHandoutProblem, type HandoutProblemLabeller } from '../handout-problem-label'

/**
 * A fixture handout index holding a single handout, so the label's two absent-content cases can be told apart
 * against known data rather than the real content file.
 */
vi.mock('@/content/handouts.json', () => {
  // The one fixture handout, under one category
  const sections = [
    {
      categoryKey: 'algebra',
      category: { en: 'Algebra', sk: 'Algebra', cs: 'Algebra' },
      handouts: [
        {
          id: 'AbC-123',
          slug: { en: 'means', sk: 'priemery', cs: 'prumery' },
          title: { en: 'Means', sk: 'Priemery', cs: 'Průměry' },
          description: { en: 'A handout.', sk: 'Materiál.', cs: 'Materiál.' },
          difficulty: 1,
          authors: ['Patrik Bak'],
          publishedAt: '2026-01-01',
          updatedAt: '2026-01-01',
        } satisfies HandoutMetadata,
      ],
    },
  ]

  // The index as the module exports it
  return { default: { sections } }
})

/**
 * A fixture environment index matching the handout above, plus one entry naming a handout the site no longer
 * has, which is the drift a deleted handout leaves behind.
 */
vi.mock('@/content/handout-env-index.json', () => ({
  default: {
    'AbC-123': {
      V8pQ2mZxK7nLrT4wYc1Db: {
        type: 'problem',
        number: 4,
        slug: { en: 'three-numbers-mean', sk: 'priemer-troch-cisel', cs: 'prumer-tri-cisel' },
      },
    },
    GoneFromIndex: {
      Gx3vT9pL6nW2sB8dF4hKq: { type: 'problem', number: 1, slug: { en: 'orphan' } },
    },
  },
}))

/** How the tests name the environment kinds, the deleted handout, and the language to read in. */
const labeller: HandoutProblemLabeller = {
  environmentLabels: {
    theorem: 'Theorem',
    exercise: 'Exercise',
    example: 'Example',
    problem: 'Problem',
    definition: 'Definition',
  },
  deletedHandoutLabel: 'Deleted handout',
  locale: 'en',
}

describe('describeHandoutProblem', () => {
  it('names the handout and which of its environments the problem is', () => {
    // A problem the fixture content still places
    const label = describeHandoutProblem(
      { handoutContentId: 'AbC-123', environmentId: 'V8pQ2mZxK7nLrT4wYc1Db' },
      labeller
    )

    // Its handout, and the kind-and-number naming it inside that handout
    expect(label).toEqual({
      handoutTitle: 'Means',
      isHandoutOnSite: true,
      environment: { label: 'Problem 4', type: 'problem' },
      link: {
        handoutSlug: 'means',
        anchorId: 'env-three-numbers-mean',
        href: '/handouts/means#env-three-numbers-mean',
      },
    })
  })

  it('falls back to the deleted-handout label when the handout is gone from the site', () => {
    // A problem in a handout only the environment index still knows about
    const label = describeHandoutProblem(
      { handoutContentId: 'GoneFromIndex', environmentId: 'Gx3vT9pL6nW2sB8dF4hKq' },
      labeller
    )

    // Nothing names it any more, so the label says the handout is gone
    expect(label).toEqual({
      handoutTitle: 'Deleted handout',
      isHandoutOnSite: false,
      environment: null,
      link: null,
    })
  })

  it('keeps naming the handout when only the problem is gone from it', () => {
    // An environment id the fixture handout doesn't carry, as a renamed or dropped one leaves behind
    const label = describeHandoutProblem(
      { handoutContentId: 'AbC-123', environmentId: 'renamed-environment' },
      labeller
    )

    // The handout is still on the site and still names itself, and only which problem it was is lost
    expect(label).toEqual({
      handoutTitle: 'Means',
      isHandoutOnSite: true,
      environment: null,
      link: null,
    })
  })
})
