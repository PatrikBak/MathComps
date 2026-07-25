import { describe, expect, it } from 'vitest'

import { blockSequenceToMarkdown } from '../handout-content-source'
import type { RawContentBlock } from '../handout-content-types'

describe('blockSequenceToMarkdown', () => {
  it('passes plain text through', () => {
    // A lone text block flattens to its text
    const result = blockSequenceToMarkdown([{ type: 'text', text: 'Hello world' }])

    // The text survives verbatim
    expect(result).toBe('Hello world')
  })

  it('wraps inline vs display math in the matching delimiters', () => {
    // Inline and display math in sequence
    const result = blockSequenceToMarkdown([
      { type: 'text', text: 'a ' },
      { type: 'math', text: 'x^2', isDisplay: false },
      { type: 'math', text: '\\int f', isDisplay: true },
    ])

    // Inline math stays inline; display math sits alone between blank lines
    expect(result).toBe('a $x^2$\n\n$$\\int f$$')
  })

  it('separates paragraphs with a blank line and emphasizes bold/italic', () => {
    // Two paragraphs, one carrying bold and italic runs
    const result = blockSequenceToMarkdown([
      { type: 'paragraph', highligted: false, content: [{ type: 'text', text: 'First.' }] },
      {
        type: 'paragraph',
        highligted: false,
        content: [
          { type: 'bold', content: [{ type: 'text', text: 'B' }] },
          { type: 'text', text: ' ' },
          { type: 'italic', content: [{ type: 'text', text: 'I' }] },
        ],
      },
    ])

    // Paragraphs are blank-line separated; bold/italic use markdown emphasis
    expect(result).toBe('First.\n\n**B** *I*')
  })

  it('renders a quote inline, not as a blockquote', () => {
    // A quote embedded mid-sentence (handouts render these inline)
    const result = blockSequenceToMarkdown([
      { type: 'text', text: 'find the flaw in the ' },
      { type: 'quote', content: [{ type: 'text', text: 'proof' }] },
      { type: 'text', text: ' below' },
    ])

    // The quote stays on the line as an italicized, quoted run
    expect(result).toBe('find the flaw in the *"proof"* below')
  })

  it('renders a link as markdown link syntax', () => {
    // A link block wrapping text
    const result = blockSequenceToMarkdown([
      { type: 'link', url: 'https://example.com', content: [{ type: 'text', text: 'here' }] },
    ])

    // Markdown link syntax with the url preserved
    expect(result).toBe('[here](https://example.com)')
  })

  it('numbers ordered lists and dashes bullet lists', () => {
    // A numbered list
    const ordered = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [[{ type: 'text', text: 'one' }], [{ type: 'text', text: 'two' }]],
      },
    ])

    // A bullet list
    const bulleted = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'Bullet',
        items: [[{ type: 'text', text: 'a' }], [{ type: 'text', text: 'b' }]],
      },
    ])

    // Ordered items get numbered markers, bullets get dashes, each wrapped in its style directive
    expect(ordered).toBe(':::list{style=number-dot}\n1. one\n2. two\n:::')
    expect(bulleted).toBe(':::list{style=bullet}\n- a\n- b\n:::')
  })

  it('keeps display math inside a list item on the item line', () => {
    // A numbered list whose items each pair a label with a display formula
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [
          [
            { type: 'text', text: 'Arithmetic sum:' },
            { type: 'math', text: 'S_n', isDisplay: true },
          ],
          [
            { type: 'text', text: 'Geometric sum:' },
            { type: 'math', text: 'G_n', isDisplay: true },
          ],
        ],
      },
    ])

    // Each formula rides on its item's line so no blank line splits the list; markers stay sequential
    expect(result).toBe(
      ':::list{style=number-dot}\n1. Arithmetic sum: $$S_n$$\n2. Geometric sum: $$G_n$$\n:::'
    )
  })

  it('wraps a lettered list in a lower-alpha-parens directive so its markers survive', () => {
    // A list styled with (a), (b) markers in the source AST
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'LowerAlphaParens',
        items: [[{ type: 'text', text: 'first' }], [{ type: 'text', text: 'second' }]],
      },
    ])

    // The directive carries the style; the plain ordinal markers inside are repainted as (a), (b)
    expect(result).toBe(':::list{style=lower-alpha-parens}\n1. first\n2. second\n:::')
  })

  it('keeps a paragraph-plus-formula list item on one line', () => {
    // The real handout shape: each item is a paragraph label (with inline math) then a display formula
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'LowerAlphaParens',
        items: [
          [
            {
              type: 'paragraph',
              highligted: false,
              content: [
                { type: 'text', text: 'Geometric sum (' },
                { type: 'math', text: 'q \\neq 1', isDisplay: false },
                { type: 'text', text: '):' },
              ],
            },
            { type: 'math', text: 'F', isDisplay: true },
          ],
        ],
      },
    ])

    // The paragraph flattens inline so the marker, label, and formula stay on one item line
    expect(result).toBe(
      ':::list{style=lower-alpha-parens}\n1. Geometric sum ($q \\neq 1$): $$F$$\n:::'
    )
  })

  it('separates two paragraph blocks in one list item with a space rather than gluing them', () => {
    // A list item holding two consecutive paragraph blocks, as real handout solutions produce
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [
          [
            {
              type: 'paragraph',
              highligted: false,
              content: [{ type: 'text', text: 'First para.' }],
            },
            {
              type: 'paragraph',
              highligted: false,
              content: [{ type: 'text', text: 'Second para.' }],
            },
          ],
        ],
      },
    ])

    // The paragraphs sit on the item line with a single space between them, not run together
    expect(result).toBe(':::list{style=number-dot}\n1. First para. Second para.\n:::')
  })

  it('nests a list inside a parent item as an indented plain sub-list', () => {
    // A numbered list whose first item carries a nested lettered sub-list
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [
          [
            { type: 'text', text: 'Cases:' },
            {
              type: 'list',
              styleType: 'LowerAlphaParens',
              items: [[{ type: 'text', text: 'even' }], [{ type: 'text', text: 'odd' }]],
            },
          ],
          [{ type: 'text', text: 'Done' }],
        ],
      },
    ])

    // The sub-list rides indented under its parent item, with no blank line breaking the parent fence
    expect(result).toBe(':::list{style=number-dot}\n1. Cases:\n   1. even\n   2. odd\n2. Done\n:::')
  })

  it('compounds the indent for a list nested three levels deep', () => {
    // A numbered list whose item carries a numbered sub-list whose item carries a bullet sub-sub-list
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [
          [
            { type: 'text', text: 'Cases:' },
            {
              type: 'list',
              styleType: 'NumberParens',
              items: [
                [
                  { type: 'text', text: 'even' },
                  {
                    type: 'list',
                    styleType: 'Bullet',
                    items: [[{ type: 'text', text: 'small' }], [{ type: 'text', text: 'big' }]],
                  },
                ],
                [{ type: 'text', text: 'odd' }],
              ],
            },
          ],
        ],
      },
    ])

    // Each level hangs its children under its own marker, so the indent stacks 0 / 3 / 6 spaces
    expect(result).toBe(
      ':::list{style=number-dot}\n1. Cases:\n   1. even\n      - small\n      - big\n   2. odd\n:::'
    )
  })

  it('indents a nested list under a double-digit marker to the wider content column', () => {
    // A ten-item list whose tenth item (marker "10. ", four columns wide) carries a nested list
    const items: RawContentBlock[][] = [
      ...Array.from({ length: 9 }, (_value, index): RawContentBlock[] => [
        { type: 'text', text: `item ${index + 1}` },
      ]),
      [
        { type: 'text', text: 'tenth' },
        { type: 'list', styleType: 'Bullet', items: [[{ type: 'text', text: 'sub' }]] },
      ],
    ]

    // Flatten the ten-item list back to markdown
    const result = blockSequenceToMarkdown([{ type: 'list', styleType: 'NumberDot', items }])

    // The sub-list sits four spaces in, matching "10. "'s content column, so CommonMark still nests it
    expect(result).toContain('10. tenth\n    - sub')
  })

  it('keeps a block after a nested sub-list on its own line, not glued to the last sub-item', () => {
    // A numbered list whose item carries a nested sub-list followed by a concluding sentence
    const result = blockSequenceToMarkdown([
      {
        type: 'list',
        styleType: 'NumberDot',
        items: [
          [
            { type: 'text', text: 'Cases:' },
            {
              type: 'list',
              styleType: 'LowerAlphaParens',
              items: [[{ type: 'text', text: 'even' }], [{ type: 'text', text: 'odd' }]],
            },
            { type: 'text', text: 'so the claim holds.' },
          ],
        ],
      },
    ])

    // The trailing sentence hangs under the marker on its own line, not fused onto the last sub-item
    expect(result).toBe(
      ':::list{style=number-dot}\n1. Cases:\n   1. even\n   2. odd\n   so the claim holds.\n:::'
    )
  })

  it('drops figures and footnotes', () => {
    // Text interrupted by an image and a footnote
    const result = blockSequenceToMarkdown([
      { type: 'text', text: 'see' },
      { type: 'image', id: 'fig-1', scale: 1, isInline: false },
      { type: 'footnote', content: [{ type: 'text', text: 'aside' }] },
      { type: 'text', text: ' it' },
    ])

    // The figure and footnote leave no trace
    expect(result).toBe('see it')
  })

  it('collapses stray blank lines and trims the ends', () => {
    // A leading display-math block would otherwise open with blank lines
    const result: string = blockSequenceToMarkdown([
      { type: 'math', text: 'y', isDisplay: true },
      { type: 'paragraph', highligted: false, content: [{ type: 'text', text: 'done' }] },
    ] as RawContentBlock[])

    // No leading/trailing whitespace, and never more than one blank line between blocks
    expect(result).toBe('$$y$$\n\ndone')
  })
})
