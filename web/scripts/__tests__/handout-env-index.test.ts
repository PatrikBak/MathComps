import path from 'path'
import { describe, expect, it } from 'vitest'

import type { HandoutMetadata } from '../../src/components/features/handouts/handout-metadata-types'
import {
  collectAllHandoutEnvironments,
  type CollectedEnvironment,
  collectHandoutEnvironments,
  toHandoutEnvIndex,
} from '../handout-env-index'

/** The fixture's root: a handouts.json plus a `content/` directory, mirroring the real `src/content/` layout. */
const FIXTURE_ROOT = path.join(__dirname, '..', '__fixtures__', 'handout-env-index')

/** The fixture's content directory. */
const FIXTURE_CONTENT_DIR = path.join(FIXTURE_ROOT, 'content')

/** The fixture's handout: two sections, a problem/theorem/paragraph mix in the first and a second problem plus
 * an exercise in the second — enough to prove the per-type counter runs across the whole document rather than
 * resetting per section, and that a paragraph contributes nothing to any counter. It exists in Slovak and
 * English, which name the same environments differently, and not in Czech. */
const FIXTURE_HANDOUT: HandoutMetadata = {
  id: 'fixture-handout-1',
  fileSlug: 'fixture',
  slug: { en: 'fixture', sk: 'fixture', cs: 'fixture' },
  title: { en: 'Fixture', sk: 'Fixture', cs: 'Fixture' },
  description: { en: 'A fixture.', sk: 'Fixture.', cs: 'Fixture.' },
  difficulty: 1,
  authors: ['Test'],
  publishedAt: '2026-01-01',
  updatedAt: '2026-01-01',
}

describe('collectHandoutEnvironments', () => {
  it('numbers environments per type across the whole document, not reset per section', () => {
    // Collect the fixture handout's environments
    const environments = collectHandoutEnvironments(FIXTURE_HANDOUT, FIXTURE_CONTENT_DIR)

    // Each carries its handout, id, type, per-type number, and every language's own name, in document order.
    // The names are spelled out per locale rather than derived: reading one variant's name for every language
    // is the plausible refactor here, and it would ship the Slovak name on the English page.
    expect(environments).toEqual([
      {
        handoutContentId: 'fixture-handout-1',
        environmentId: 'first-problem',
        environmentType: 'problem',
        environmentNumber: 1,
        environmentSlugs: { sk: 'prva-uloha', en: 'the-first-problem' },
        source: 'fixture.sk.json',
      },
      {
        handoutContentId: 'fixture-handout-1',
        environmentId: 'only-theorem',
        environmentType: 'theorem',
        environmentNumber: 1,
        environmentSlugs: { sk: 'jedina-veta', en: 'the-only-theorem' },
        source: 'fixture.sk.json',
      },
      {
        handoutContentId: 'fixture-handout-1',
        environmentId: 'second-problem',
        environmentType: 'problem',
        environmentNumber: 2,
        environmentSlugs: { sk: 'druha-uloha', en: 'the-second-problem' },
        source: 'fixture.sk.json',
      },
      {
        handoutContentId: 'fixture-handout-1',
        environmentId: 'only-exercise',
        environmentType: 'exercise',
        environmentNumber: 1,
        environmentSlugs: { sk: 'jedine-cvicenie', en: 'the-only-exercise' },
        source: 'fixture.sk.json',
      },
    ])
  })

  it('numbers from the first declared language when the handout has no default-locale variant', () => {
    // A handout published in en and cs but not in the default locale
    const environments = collectHandoutEnvironments(
      { ...FIXTURE_HANDOUT, fileSlug: 'en-only', languages: ['en', 'cs'] },
      FIXTURE_CONTENT_DIR
    )

    // It is read from the variant it actually has, rather than silently vanishing from the index
    expect(environments).toEqual([
      {
        handoutContentId: 'fixture-handout-1',
        environmentId: 'only-en-problem',
        environmentType: 'problem',
        environmentNumber: 1,
        environmentSlugs: { en: 'the-only-problem' },
        source: 'en-only.en.json',
      },
    ])
  })

  it('refuses a handout that declares an empty language list', () => {
    // A declared-but-empty list leaves no variant to number from
    const collect = () =>
      collectHandoutEnvironments({ ...FIXTURE_HANDOUT, languages: [] }, FIXTURE_CONTENT_DIR)

    // Loud, rather than quietly contributing nothing to the index
    expect(collect).toThrow(/empty languages list/)
  })

  it('yields nothing for a handout with no content file yet', () => {
    // A handout entry whose content file was never built
    const environments = collectHandoutEnvironments(
      { ...FIXTURE_HANDOUT, fileSlug: 'does-not-exist' },
      FIXTURE_CONTENT_DIR
    )

    // Nothing to collect, rather than throwing
    expect(environments).toEqual([])
  })
})

describe('collectAllHandoutEnvironments', () => {
  it('walks handouts.json rather than the content directory, in index order', () => {
    // Collect every environment the fixture index declares
    const environments = collectAllHandoutEnvironments(
      path.join(FIXTURE_ROOT, 'handouts.json'),
      FIXTURE_CONTENT_DIR
    )

    // In the index's own order
    expect(environments.map((environment) => environment.environmentId)).toEqual([
      'first-problem',
      'only-theorem',
      'second-problem',
      'only-exercise',
    ])
  })
})

describe('toHandoutEnvIndex', () => {
  /**
   * Builds a collected entry, defaulting everything the assertion below doesn't care about.
   *
   * @param handoutContentId - The handout the environment belongs to.
   * @param environmentId - The environment's permanent id.
   * @param environmentNumber - The number the page displays for it.
   *
   * @returns The collected entry.
   */
  function entry(
    handoutContentId: string,
    environmentId: string,
    environmentNumber: number
  ): CollectedEnvironment {
    return {
      handoutContentId,
      environmentId,
      environmentType: 'problem',
      environmentNumber,
      environmentSlugs: { sk: 'prva-uloha' },
      source: 'fixture.sk.json',
    }
  }

  it('keys by handout content id, then by the raw environment id', () => {
    // The same environment id used by two different handouts
    const index = toHandoutEnvIndex([
      entry('handout-1', 'shared-id', 1),
      entry('handout-2', 'shared-id', 7),
    ])

    // The nesting is the exact shape resolveHandoutProblemRef indexes into, so it is spelled out in full
    // rather than derived — a re-keying refactor type-checks fine and would silently resolve nothing
    expect(index).toEqual({
      'handout-1': {
        'shared-id': { type: 'problem', number: 1, slug: { sk: 'prva-uloha' } },
      },
      'handout-2': {
        'shared-id': { type: 'problem', number: 7, slug: { sk: 'prva-uloha' } },
      },
    })
  })

  it('collapses a within-handout duplicate to the last entry', () => {
    // One handout, one id, claimed twice
    const index = toHandoutEnvIndex([entry('handout-1', 'dup', 1), entry('handout-1', 'dup', 2)])

    // The fold is documented as lossy, so the later entry wins; catching the duplicate is the validator's job
    expect(index['handout-1']['dup'].number).toBe(2)
  })
})
