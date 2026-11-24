import { describe, expect, it } from 'vitest'

import { renderMarkdown } from '../../__tests__/support/render-markdown'

describe('remarkFigure', () => {
  it('draws the caption under the image, its math rendered', async () => {
    // A figure whose caption names a value in math
    const html = await renderMarkdown(':::figure[Figure 1. Example for $m = 5$]\n![](media:a)\n:::')

    // The image first, then the caption holding the rendered math
    expect(html).toMatch(
      /^<figure><p><img src="media:a" alt=""><\/p><figcaption>Figure 1\. Example for <span class="math-nowrap"><span class="katex">.*<\/figcaption><\/figure>$/s
    )
  })

  it('draws a figure with an empty caption as the image alone', async () => {
    // A figure whose brackets hold nothing
    const html = await renderMarkdown(':::figure[]\n![](media:a)\n:::')

    // No caption under the image
    expect(html).toBe('<figure><p><img src="media:a" alt=""></p></figure>')
  })

  it('draws a table written as display math as the figure', async () => {
    // A figure whose body is a one-line array
    const html = await renderMarkdown(
      ':::figure[Obr. 1]\n$$\\begin{array}{|c|}\\hline a \\\\ \\hline\\end{array}$$\n:::'
    )

    // The table rendered in the figure, the caption under it
    expect(html).toMatch(
      /^<figure><span class="katex-display">.*<\/span><figcaption>Obr\. 1<\/figcaption><\/figure>$/s
    )
  })
})
