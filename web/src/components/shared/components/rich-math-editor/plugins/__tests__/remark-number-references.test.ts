import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../../__tests__/support/render-markdown'
import { remarkNumberReferences } from '../remark-number-references'

describe('remarkNumberReferences', () => {
  it('turns a #N into a reference naming N, the text around it kept', async () => {
    // A sentence naming a problem
    const html = await renderMarkdown('harder than #12, I think', [remarkNumberReferences])

    // The number as a reference between the two stretches of text
    expect(html).toBe('<p>harder than <number-ref data-number="12">#12</number-ref>, I think</p>')
  })

  it('turns a text that is nothing but a #N into a reference', async () => {
    // A lone number
    const html = await renderMarkdown('#12', [remarkNumberReferences])

    // The reference alone
    expect(html).toBe('<p><number-ref data-number="12">#12</number-ref></p>')
  })

  it('turns every #N of a line, one glued to a slot name among them', async () => {
    // A slot named with its problem, and a second problem
    const html = await renderMarkdown('C5#17 or #3', [remarkNumberReferences])

    // Both numbers as references
    expect(html).toBe(
      '<p>C5<number-ref data-number="17">#17</number-ref> or <number-ref data-number="3">#3</number-ref></p>'
    )
  })

  it('turns a #N inside bold text and inside a spoiler', async () => {
    // A bold number, and one hidden under a spoiler
    const html = await renderMarkdown('**#12**\n\n:::spoiler[Hint]\nLike #4.\n:::', [
      remarkNumberReferences,
    ])

    // Both as references
    expect(html).toContain('<strong><number-ref data-number="12">#12</number-ref></strong>')
    expect(html).toContain('Like <number-ref data-number="4">#4</number-ref>.')
  })

  it.each([
    ['inline math', String.raw`$\#12$`],
    ['display math', String.raw`$$\#12$$`],
    ['inline code', '`#12`'],
    ['a fenced block', '```\n#12\n```'],
    ['a bare address', 'https://example.com/page#12'],
    ['a longer word', '#12a'],
  ])('leaves a #N in %s as it is', async (_description, markdown) => {
    // The number where it is part of something else
    const html = await renderMarkdown(markdown, [remarkNumberReferences])

    // No reference
    expect(html).not.toContain('<number-ref')
  })
})
