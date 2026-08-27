import { describe, expect, it } from 'vitest'

import type { HandoutProblemLabeller } from '@/components/features/handouts/handout-problem-label'

import {
  toProblemFacet,
  toPromptVersionFacetOptions,
  toUserFacetOptions,
} from '../defense-review-facet-options'
import type {
  DefenseReviewProblemOption,
  DefenseReviewPromptVersionOption,
  DefenseReviewUserOption,
} from '../defense-review-types'

/**
 * What the tests call somebody the site holds neither a name nor an address for.
 */
const UNNAMED = 'User'

/**
 * How the tests name a problem. The ids below name nothing on the site, so everything resolved through this
 * lands on the wording standing in for a handout that is gone.
 */
const LABELLER: HandoutProblemLabeller = {
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

/**
 * Two problems held against two handouts that have both since gone from the site.
 */
const OUTLIVED_PROBLEMS: DefenseReviewProblemOption[] = [
  {
    target: {
      kind: 'handout',
      handoutContentId: 'gone-handout-1',
      environmentId: 'gone-problem-1',
    },
    conversationCount: 3,
  },
  {
    target: {
      kind: 'handout',
      handoutContentId: 'gone-handout-2',
      environmentId: 'gone-problem-2',
    },
    conversationCount: 1,
  },
]

/**
 * One competition run in two seasons, each with the same problem number, which is what makes the two options
 * indistinguishable without the season.
 */
const ARCHIVE_PROBLEMS: DefenseReviewProblemOption[] = [2026, 2027].map((startYear) => ({
  target: {
    kind: 'problem',
    slug: `${startYear}-mc-advanced-1-2`,
    source: {
      season: {
        slug: '76',
        displayName: `Edition 76 (${startYear}/${startYear + 1})`,
        fullName: null,
      },
      startYear,
      competition: [
        { slug: 'mc', displayName: 'MathComps', fullName: null },
        { slug: 'mc-advanced', displayName: 'Advanced', fullName: null },
        { slug: 'mc-advanced-1', displayName: 'September', fullName: null },
      ],
      number: 2,
    },
  },
  conversationCount: 1,
}))

describe('toProblemFacet', () => {
  it('collapses the handouts that are gone into one section', () => {
    // Two removed handouts, which nothing on this side can tell apart beyond their content ids
    const facet = toProblemFacet(OUTLIVED_PROBLEMS, LABELLER, 'Problem')

    // One heading rather than a run of identical ones, since two of them read as the same section twice
    expect(Object.values(facet.sectionLabels)).toEqual(['Deleted handout'])
  })

  it('files the problems outliving their handouts under the one section that names them', () => {
    // The same two problems, as the facet lists them
    const facet = toProblemFacet(OUTLIVED_PROBLEMS, LABELLER, 'Problem')

    // Both land in the section the headings name, rather than in one apiece that nothing renders
    expect(new Set(facet.options.map((option) => option.groupKey))).toEqual(
      new Set(Object.keys(facet.sectionLabels))
    )
  })
})

describe('toProblemFacet, over the archive', () => {
  it('heads a competition with the season it ran in, so two runs of it read apart', () => {
    // The same competition run in two seasons, which its own name is the same for
    const facet = toProblemFacet(ARCHIVE_PROBLEMS, LABELLER, 'Problem')

    // Each season heads its own section, rather than both runs filing under one
    expect(Object.values(facet.sectionLabels).sort()).toEqual([
      'MathComps Advanced September 2026/2027',
      'MathComps Advanced September 2027/2028',
    ])
  })

  it('names the option by the problem alone, the competition being what the heading says', () => {
    // The problems as the facet lists them
    const facet = toProblemFacet(ARCHIVE_PROBLEMS, LABELLER, 'Problem')

    // Which reads as the problem's own place in its competition
    expect(facet.options.map((option) => option.displayName)).toEqual(['Problem 2', 'Problem 2'])
  })
})

describe('toPromptVersionFacetOptions', () => {
  it('leads with the most recently introduced revision, whatever order it was handed', () => {
    // An older revision the examiner was reverted to, which comes back at the top of the backend's ordering
    const versions: DefenseReviewPromptVersionOption[] = [
      {
        version: 'reverted',
        firstSeenAt: '2026-03-01T09:00:00Z',
        lastSeenAt: '2026-08-01T09:00:00Z',
        conversationCount: 12,
      },
      {
        version: 'newest',
        firstSeenAt: '2026-07-01T09:00:00Z',
        lastSeenAt: '2026-07-20T09:00:00Z',
        conversationCount: 4,
      },
    ]

    // Read as the facet shows them, each labelled by when it first ran
    const options = toPromptVersionFacetOptions(versions, (isoDate) => isoDate)

    // The labels descend, so the ordering the facet claims and the dates it shows say one thing
    expect(options.map((option) => option.id)).toEqual(['newest', 'reverted'])
    expect(options.map((option) => option.displayName)).toEqual([
      '2026-07-01T09:00:00Z',
      '2026-03-01T09:00:00Z',
    ])
  })
})

describe('toUserFacetOptions', () => {
  it('names a student by their username and their address', () => {
    // A student the site holds both halves of
    const users: DefenseReviewUserOption[] = [
      { user: { id: '1', username: 'peto', email: 'peto@example.com' }, conversationCount: 3 },
    ]

    // Both ride in the label, since the label is also what the facet's search reads
    expect(toUserFacetOptions(users, UNNAMED)[0].displayName).toBe('peto (peto@example.com)')
  })

  it('falls back to whichever half is left', () => {
    // One student who has yet to choose a name, and one whose account is deleted so the address is gone
    const users: DefenseReviewUserOption[] = [
      { user: { id: '1', username: null, email: 'nameless@example.com' }, conversationCount: 1 },
      { user: { id: '2', username: 'quiet', email: null }, conversationCount: 1 },
    ]

    // Each is still listed under what the site does hold, rather than under a placeholder
    expect(toUserFacetOptions(users, UNNAMED).map((option) => option.displayName)).toEqual([
      'nameless@example.com',
      'quiet',
    ])
  })

  it('falls back to the label when neither half is left', () => {
    // A deleted account that never chose a name, which leaves nothing to name it by
    const users: DefenseReviewUserOption[] = [
      { user: { id: '1', username: null, email: null }, conversationCount: 1 },
    ]

    // Named by the label, since the row is still in the queue and has to say who held the conversation
    expect(toUserFacetOptions(users, UNNAMED)[0].displayName).toBe(UNNAMED)
  })
})
