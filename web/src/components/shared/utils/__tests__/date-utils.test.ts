import { describe, expect, it } from 'vitest'

import { formatMonthAndYear } from '../date-utils'

describe('formatMonthAndYear', () => {
  it('names the month in the language it is read in', () => {
    // One instant, spelled three ways, capitalised the way a heading wants it
    expect(formatMonthAndYear('2026-01-15T00:00:00.000Z', 'sk')).toBe('Január 2026')
    expect(formatMonthAndYear('2026-01-15T00:00:00.000Z', 'cs')).toBe('Leden 2026')
    expect(formatMonthAndYear('2026-01-15T00:00:00.000Z', 'en')).toBe('January 2026')
  })

  it('reads the month in UTC rather than wherever the reader is', () => {
    // Late on the last day of a month is the next one east of Greenwich, and the heading must not move
    expect(formatMonthAndYear('2026-03-31T23:30:00.000Z', 'en')).toBe('March 2026')
  })

  it('carries the year, which a program running for years has to tell apart', () => {
    // Two Decembers a year apart must not read as the same heading
    expect(formatMonthAndYear('2027-12-01T00:00:00.000Z', 'sk')).toBe('December 2027')
  })
})
