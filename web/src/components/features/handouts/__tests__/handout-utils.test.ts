import { describe, expect, it } from 'vitest'

import type { Document, EnvironmentBlock } from '../handout-content-types'
import { listDocumentEnvironments } from '../handout-utils'

/**
 * Builds a minimal problem block carrying the given id, with only the fields the environment walk reads.
 *
 * @param id - The environment's permanent id.
 *
 * @returns The block.
 */
function problemBlock(id: string): EnvironmentBlock {
  // The walk reads only `type` and `id`, so the rest stays empty
  return { type: 'problem', id, slug: id, difficulty: 1, body: [], hints: [], solution: [] }
}

/**
 * Builds a one-section document holding the given blocks, with only the fields the environment walk reads.
 *
 * @param content - The blocks to place at the section's top level.
 *
 * @returns A document wrapping them.
 */
function documentWith(content: unknown[]): Document {
  // Only sections[].text.content is walked, so the rest of the shape can stay minimal
  return {
    title: 'Fixture',
    sections: [{ title: 'Only', level: 1, text: { content } }],
  } as Document
}

describe('listDocumentEnvironments', () => {
  it('hands back the document’s own block objects, not copies of them', () => {
    // Two environments sharing one id, so identity is the only thing telling them apart
    const first = problemBlock('same-id')
    const second = problemBlock('same-id')
    const document = documentWith([first, second])

    // Walk the document
    const environments = listDocumentEnvironments(document)

    // Each entry carries the very object from the document, which is what lets a caller key a Map by block
    expect(environments[0].block).toBe(first)
    expect(environments[1].block).toBe(second)

    // And a Map keyed that way still resolves both, where keying by id would have collapsed them
    const numbers = new Map(
      environments.map((environment) => [environment.block, environment.number])
    )
    expect(numbers.get(first)).toBe(1)
    expect(numbers.get(second)).toBe(2)
  })
})
