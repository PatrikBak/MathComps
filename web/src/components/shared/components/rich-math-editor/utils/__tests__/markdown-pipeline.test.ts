import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../../__tests__/support/render-markdown'

/**
 * Renders markdown and picks out the opening tag of every list in it, in document order.
 *
 * @param markdown - The markdown+TeX source to render.
 * @returns Each list's opening tag, attributes included.
 */
async function listOpenings(markdown: string): Promise<string[]> {
  // The content as the renderer turns it into HTML
  const html = await renderMarkdown(markdown)

  // The opening tags of its numbered and bulleted lists
  return html.match(/<(?:ol|ul)\b[^>]*>/g) ?? []
}

describe('numbered lists', () => {
  it('go on from the number written after a quote splits them', async () => {
    // A comment numbering its points, a quote and a sentence under the first
    const openings = await listOpenings('1.\n> A quoted line.\n\nA sentence about $x$.\n\n2.')

    // The second list starts at 2
    expect(openings).toEqual(['<ol>', '<ol start="2">'])
  })

  it('go on from the number written after a paragraph splits them', async () => {
    // A statement asking two questions, a paragraph of data between them
    const openings = await listOpenings(
      '1. The first question?\n\nA paragraph of data.\n\n2. The second question?'
    )

    // The second question is numbered 2
    expect(openings).toEqual(['<ol>', '<ol start="2">'])
  })

  it('go on from the number written after display math splits them', async () => {
    // Two steps with a formula on its own lines between them
    const openings = await listOpenings(
      '1. Bound the sum.\n\n$$\nS \\le n^2\n$$\n\n2. Show equality.'
    )

    // The second step is numbered 2
    expect(openings).toEqual(['<ol>', '<ol start="2">'])
  })

  it('keep the number they start at inside a spoiler', async () => {
    // A hint numbered as the third step
    const openings = await listOpenings(':::spoiler[Hint]\n3. Look at the third case.\n:::')

    // Numbered from 3
    expect(openings).toEqual(['<ol start="3">'])
  })

  it('keep a start of 0', async () => {
    // A list counting from zero
    const openings = await listOpenings('0. Base case.\n1. Step.')

    // Numbered from 0
    expect(openings).toEqual(['<ol start="0">'])
  })

  it('keep the start of a list written in HTML, and nothing else of its attributes', async () => {
    // A list written as HTML, reversed and lettered
    const openings = await listOpenings('<ol start="5" reversed type="a"><li>Fifth.</li></ol>')

    // Only the start survives the sanitizer
    expect(openings).toEqual(['<ol start="5">'])
  })

  it('count from 1 in a styled list, whatever its first item says', async () => {
    // A roman list whose first item says 3, which the validator reports
    const openings = await listOpenings(':::list{style=lower-roman-parens}\n3. Third.\n:::')

    // Drawn styled, with no start
    expect(openings).toEqual(['<ol class="list-style-lower-roman-parens">'])
  })
})
