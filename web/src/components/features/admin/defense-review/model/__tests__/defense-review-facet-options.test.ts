import { describe, expect, it } from 'vitest'

import type { HandoutProblemLabeller } from '@/components/features/handouts/handout-problem-label'

import { toProblemFacet, toPromptVersionFacetOptions } from '../defense-review-facet-options'
import type {
  DefenseReviewProblemOption,
  DefenseReviewPromptVersionOption,
} from '../defense-review-types'

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
    target: { handoutContentId: 'gone-handout-1', environmentId: 'gone-problem-1' },
    conversationCount: 3,
  },
  {
    target: { handoutContentId: 'gone-handout-2', environmentId: 'gone-problem-2' },
    conversationCount: 1,
  },
]

describe('toProblemFacet', () => {
  it('collapses the handouts that are gone into one section', () => {
    // Two removed handouts, which nothing on this side can tell apart beyond their content ids
    const facet = toProblemFacet(OUTLIVED_PROBLEMS, LABELLER)

    // One heading rather than a run of identical ones, since two of them read as the same section twice
    expect(Object.values(facet.sectionLabels)).toEqual(['Deleted handout'])
  })

  it('files the problems outliving their handouts under the one section that names them', () => {
    // The same two problems, as the facet lists them
    const facet = toProblemFacet(OUTLIVED_PROBLEMS, LABELLER)

    // Both land in the section the headings name, rather than in one apiece that nothing renders
    expect(new Set(facet.options.map((option) => option.groupKey))).toEqual(
      new Set(Object.keys(facet.sectionLabels))
    )
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
