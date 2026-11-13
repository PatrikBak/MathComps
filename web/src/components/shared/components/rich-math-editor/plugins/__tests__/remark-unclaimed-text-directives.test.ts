import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../../__tests__/support/render-markdown'

describe('remarkUnclaimedTextDirectives', () => {
  it('keeps a ratio and a time written without spaces', async () => {
    // A ratio and a time, each colon glued to the digits around it
    const html = await renderMarkdown('Poměr vyšel 1:2, o 12:30.')

    // The sentence as typed
    expect(html).toBe('<p>Poměr vyšel 1:2, o 12:30.</p>')
  })

  it('keeps the label and the attributes of an unclaimed directive as typed', async () => {
    // A word shaped like a directive with both a label and attributes
    const html = await renderMarkdown('a:b[**c**]{d=1} e')

    // The whole shape as text, its label left unrendered
    expect(html).toBe('<p>a:b[**c**]{d=1} e</p>')
  })

  it('leaves a claimed directive alone while putting back the one in its label', async () => {
    // An inline quote holding a ratio
    const html = await renderMarkdown(':quote[pomer 1:2]')

    // The quote, the ratio inside it as typed
    expect(html).toBe('<p><q>pomer 1:2</q></p>')
  })
})
