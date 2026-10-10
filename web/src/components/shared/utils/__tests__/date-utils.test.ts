import { describe, expect, it } from 'vitest'

import {
  coversWholeLocalDays,
  formatMonthAndYear,
  isCalendarDate,
  isInstantWithOffset,
} from '../date-utils'

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

describe('isCalendarDate', () => {
  it('accepts a leap day', () => {
    // 2024 is a leap year, so February runs to the 29th
    expect(isCalendarDate('2024-02-29')).toBe(true)
  })

  it.each(['2026-02-30', '2024-13-01', '2026-9-14', 'not-a-date'])('refuses %j', (value) => {
    // A day that rolls over, a month that doesn't exist, a month missing its leading zero, no date at all
    expect(isCalendarDate(value)).toBe(false)
  })
})

describe('isInstantWithOffset', () => {
  it.each([
    '2026-09-14T18:00:00Z',
    '2026-09-14T18:00:00.123+02:00',
    '2026-09-14T18:00:00-14:00',
    '9999-01-01T00:00:00Z',
  ])('accepts %j', (value) => {
    // Zulu, fractional seconds under an offset, the widest offset, the last year
    expect(isInstantWithOffset(value)).toBe(true)
  })

  it.each([
    '2026-09-14T18:00:00',
    '2026-09-14',
    '2026-09-14 18:00:00Z',
    '2026-02-30T18:00:00Z',
    '2026-09-14T25:00:00Z',
    '2026-09-14T24:00:00Z',
    '2026-09-14T18:00:00+15:00',
    '9999-12-31T23:00:00-01:00',
    '0000-01-01T00:00:00Z',
    '',
  ])('refuses %j', (value) => {
    // No offset, no time, a space for the T, a day that rolls over, an hour past the day, the midnight that ends a
    // day, an offset wider than any zone's, years past either end once read in UTC, and nothing
    expect(isInstantWithOffset(value)).toBe(false)
  })
})
