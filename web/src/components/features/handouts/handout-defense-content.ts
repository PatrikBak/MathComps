/**
 * Selects what an examiner is given about one handout environment: the statement the student argues over,
 * the hidden reasoning their argument is measured against, and the author's hints. Which part of an
 * environment plays the reference depends on its type, and that rule lives here alone so the page's
 * defense trigger and the generated defense-content blobs can never disagree about which environments are
 * defendable or what backs them.
 */

import { assertNever } from '@/components/shared/utils/assert-never'

import { blockSequenceToMarkdown } from './handout-content-source'
import type { EnvironmentBlock, RawContentBlock } from './handout-content-types'

/**
 * The hidden material behind one environment, still in content-block form.
 */
type DefenseSource = {
  /** The reasoning a defense is argued against; empty when the environment hides nothing. */
  reference: RawContentBlock[]
  /** The author's step-by-step hints, in order; empty when the environment has none. */
  hints: RawContentBlock[][]
}

/**
 * Everything the examiner is told about one environment, flattened to markdown/math source.
 */
export type DefenseContent = {
  /** The problem statement, seen by both sides. */
  statement: string
  /** The reference solution the examiner reasons from. */
  reference: string
  /** The author's step-by-step hints, in order; empty when the environment has none. */
  hints: string[]
}

/**
 * Picks the hidden material behind an environment: the worked solution for a problem, exercise or example,
 * the proof for a theorem. Definitions hide nothing, so they yield none. Hints are authored on problems
 * alone.
 *
 * @param block - The environment to read.
 *
 * @returns Its reference and hints, both possibly empty.
 */
function selectDefenseSource(block: EnvironmentBlock): DefenseSource {
  switch (block.type) {
    // Exercises and examples are defended against their worked solution
    case 'exercise':
    case 'example':
      return { reference: block.solution, hints: [] }
    // A problem is defended against its solution, and is the only type carrying author's hints
    case 'problem':
      return { reference: block.solution, hints: block.hints }
    // A theorem is defended against its proof
    case 'theorem':
      return { reference: block.proof, hints: [] }
    // Definitions have nothing hidden to defend
    case 'definition':
      return { reference: [], hints: [] }
    default:
      return assertNever(block)
  }
}

/**
 * Whether an environment can be defended at all, which is to say whether it hides any reasoning to argue
 * against.
 *
 * @param block - The environment to test.
 *
 * @returns True when it has a non-empty reference.
 */
export function hasDefenseReference(block: EnvironmentBlock): boolean {
  // Only the reference decides it — an environment with hints but no solution has nothing to measure against
  return selectDefenseSource(block).reference.length > 0
}

/**
 * Flattens everything the examiner is told about an environment to markdown/math source.
 *
 * @param block - The environment to read.
 *
 * @returns Its defense content, or null when it hides nothing to defend.
 */
export function toDefenseContent(block: EnvironmentBlock): DefenseContent | null {
  // The hidden material behind this environment
  const source = selectDefenseSource(block)

  // An environment with no reference is not defendable, and gets no entry rather than an empty one
  if (source.reference.length === 0) {
    return null
  }

  // The statement, reference and hints, each flattened the way the examiner reads them
  return {
    statement: blockSequenceToMarkdown(block.body),
    reference: blockSequenceToMarkdown(source.reference),
    hints: source.hints.map(blockSequenceToMarkdown),
  }
}
