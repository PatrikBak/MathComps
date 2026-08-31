import { describe, expect, it } from 'vitest'

import { coversWholeLocalDays, formatMonthAndYear } from '../date-utils'

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

describe('coversWholeLocalDays', () => {
  // The September entry window, authored as 14 September through 28 September in Bratislava
  const opensAt = new Date('2026-09-13T22:00:00.000Z')
  const closesAt = new Date('2026-09-28T21:59:59.000Z')

  it('holds in the zone the window was authored in', () => {
    // Midnight to the last minute the day has
    expect(coversWholeLocalDays(opensAt, closesAt, 'Europe/Bratislava')).toBe(true)
  })

  it('breaks two hours west, where the same span starts the evening before', () => {
    // 23:00 on the 13th through 22:59 on the 28th
    expect(coversWholeLocalDays(opensAt, closesAt, 'UTC')).toBe(false)
  })

  it('breaks in a zone offset by half an hour', () => {
    // Whole-hour zones are not the only way to miss midnight
    expect(coversWholeLocalDays(opensAt, closesAt, 'Asia/Kolkata')).toBe(false)
  })

  it('holds in any zone the window happens to land on whole days in', () => {
    // Two zones on the same offset read the same clock, wherever they are
    expect(coversWholeLocalDays(opensAt, closesAt, 'Europe/Prague')).toBe(true)
  })

  it('refuses a span closing on the first instant outside it rather than the last inside', () => {
    // The first instant of the 29th, a minute past the end of the shape
    const closesAtMidnight = new Date('2026-09-28T22:00:00.000Z')

    // Which is a different span, and one a bare date pair would say a day too many of
    expect(coversWholeLocalDays(opensAt, closesAtMidnight, 'Europe/Bratislava')).toBe(false)
  })
})
