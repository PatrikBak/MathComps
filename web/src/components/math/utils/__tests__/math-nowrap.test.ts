import { describe, expect, it } from 'vitest'

import { takeLeadingGlue, takeTrailingGlue } from '../math-nowrap'

describe('takeLeadingGlue', () => {
  it('pulls a leading punctuation run and leaves the rest with its space', () => {
    // Split text that opens with a period before more prose
    const result = takeLeadingGlue('. Na začiatku')

    // The period is the glue; the space and prose stay behind
    expect(result).toEqual({ glue: '.', rest: ' Na začiatku' })
  })

  it('pulls a multi-character closing run', () => {
    // Split text opening with a closing bracket then a period
    const result = takeLeadingGlue(').')

    // The whole non-space run hugs the formula
    expect(result).toEqual({ glue: ').', rest: '' })
  })

  it('returns no glue when the text starts with whitespace', () => {
    // Leading space means the formula already has a break opportunity after it
    const result = takeLeadingGlue(' and more')

    // Nothing to pull; text is untouched
    expect(result).toEqual({ glue: '', rest: ' and more' })
  })

  it('returns no glue for an empty string', () => {
    // No text at all
    const result = takeLeadingGlue('')

    // Empty glue, empty rest
    expect(result).toEqual({ glue: '', rest: '' })
  })
})

describe('takeTrailingGlue', () => {
  it('pulls a trailing opening run and leaves the leading text with its space', () => {
    // Split text that ends with an opening parenthesis before the formula
    const result = takeTrailingGlue('uvažujme interval (')

    // The parenthesis is the glue; the prose and its space stay behind
    expect(result).toEqual({ glue: '(', rest: 'uvažujme interval ' })
  })

  it('returns no glue when the text ends with whitespace', () => {
    // Trailing space means the formula already has a break opportunity before it
    const result = takeTrailingGlue('priradené čísla ')

    // Nothing to pull; text is untouched
    expect(result).toEqual({ glue: '', rest: 'priradené čísla ' })
  })

  it('treats an all-non-space string as entirely glue', () => {
    // No whitespace anywhere — the whole token hugs the formula
    const result = takeTrailingGlue('f(')

    // Everything is glue, nothing remains
    expect(result).toEqual({ glue: 'f(', rest: '' })
  })

  it('returns no glue for an empty string', () => {
    // No text at all
    const result = takeTrailingGlue('')

    // Empty glue, empty rest
    expect(result).toEqual({ glue: '', rest: '' })
  })
})
