import { describe, expect, it } from 'vitest'

import { hasUnbalancedDollars } from '../math-delimiters'

describe('hasUnbalancedDollars', () => {
  it('treats balanced inline math as balanced', () => {
    expect(hasUnbalancedDollars('Let $x$ and $y$ be reals.')).toBe(false)
  })

  it('treats balanced display math as balanced', () => {
    expect(hasUnbalancedDollars('Then $$\\frac{x+y}{2} > \\sqrt{xy}.$$')).toBe(false)
  })

  it('flags a missing closing delimiter', () => {
    // The live failure mode: `$K$, $L$` mistyped as `$K, $L$` — three dollars, odd
    expect(hasUnbalancedDollars('Let $K, $L$ be points on the circle.')).toBe(true)
  })

  it('flags a single lone delimiter', () => {
    expect(hasUnbalancedDollars('A stray $ sign.')).toBe(true)
  })

  it('ignores an escaped dollar', () => {
    expect(hasUnbalancedDollars('It costs \\$5 in total.')).toBe(false)
  })

  it('counts a real delimiter alongside an escaped dollar', () => {
    // The `\$5` is literal and skipped, leaving a single unmatched `$`
    expect(hasUnbalancedDollars('It costs \\$5 and uses $x here.')).toBe(true)
  })

  it('counts a dollar after an escaped backslash (\\\\$ is a real delimiter)', () => {
    // `\\` is an escaped backslash (even run), so the following `$` is unescaped — one lone delimiter
    expect(hasUnbalancedDollars('A path C:\\\\$x is unclosed.')).toBe(true)
  })

  it('ignores a dollar after a backslash-escaped dollar with a leading escaped backslash (\\\\\\$)', () => {
    // Three backslashes: an escaped backslash then an escaped `$` — the dollar is literal, count stays even
    expect(hasUnbalancedDollars('It is \\\\\\$5 only, nothing more.')).toBe(false)
  })

  it('ignores dollars inside an inline code span', () => {
    expect(hasUnbalancedDollars('Run `$x$` then $a$ for real.')).toBe(false)
  })

  it('ignores dollars inside a fenced code block', () => {
    const markdown = ['```', 'echo $a $b', '```', '', 'Then $c$ renders.'].join('\n')
    expect(hasUnbalancedDollars(markdown)).toBe(false)
  })

  it('flags a real lone delimiter even when a code span balances on its own', () => {
    const markdown = 'Code `$x$` then a stray $ here.'
    expect(hasUnbalancedDollars(markdown)).toBe(true)
  })

  it('treats prose with no dollars as balanced', () => {
    expect(hasUnbalancedDollars('Plain prose with no math at all.')).toBe(false)
  })

  it('treats an empty string as balanced', () => {
    expect(hasUnbalancedDollars('')).toBe(false)
  })
})
