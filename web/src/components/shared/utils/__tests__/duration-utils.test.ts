import { describe, expect, it } from 'vitest'

import { formatClockRemaining, formatDurationMs, splitRemaining } from '../duration-utils'

describe('formatDurationMs', () => {
  it('reads a sub-second span in whole milliseconds', () => {
    // Well under a second
    expect(formatDurationMs(312)).toBe('312 ms')
    // A fractional millisecond rounds rather than showing a decimal
    expect(formatDurationMs(0.4)).toBe('0 ms')
  })

  it('switches to tenths of a second at one second', () => {
    // The boundary itself belongs to seconds
    expect(formatDurationMs(1000)).toBe('1.0 s')
    // Just under it is still milliseconds
    expect(formatDurationMs(999)).toBe('999 ms')
    // And a long one keeps a tenth
    expect(formatDurationMs(42_350)).toBe('42.4 s')
  })

  it('switches to minutes at one minute', () => {
    // The boundary itself belongs to minutes
    expect(formatDurationMs(60_000)).toBe('1 m 0 s')
    // Just under it is still seconds
    expect(formatDurationMs(59_900)).toBe('59.9 s')
    // And the leftover seconds carry the detail
    expect(formatDurationMs(72_400)).toBe('1 m 12 s')
  })

  it('carries leftover seconds that round up to a whole minute', () => {
    // 119.7s would otherwise read as "1 m 60 s"
    expect(formatDurationMs(119_700)).toBe('2 m 0 s')
  })
})

describe('formatClockRemaining', () => {
  it('drops the hour field while there is under an hour left', () => {
    // Twenty-three minutes and change
    expect(formatClockRemaining(23 * 60_000 + 45_000)).toBe('23:45')
    // Seconds keep their leading zero, minutes do not
    expect(formatClockRemaining(5 * 60_000 + 7_000)).toBe('5:07')
  })

  it('shows the hour field from one hour up, padding the fields below it', () => {
    // The boundary itself belongs to the three-field form
    expect(formatClockRemaining(3_600_000)).toBe('1:00:00')
    // And the fields hold their places as it runs down
    expect(formatClockRemaining(3_600_000 + 23 * 60_000 + 45_000)).toBe('1:23:45')
  })

  it('truncates a part-second rather than rounding it up', () => {
    // 59.9s is still 59 seconds left, never a minute the reader does not have
    expect(formatClockRemaining(59_900)).toBe('0:59')
  })

  it('stops at zero rather than counting past it', () => {
    // A clock read after it ran out
    expect(formatClockRemaining(-5000)).toBe('0:00')
    expect(formatClockRemaining(0)).toBe('0:00')
  })
})

describe('splitRemaining', () => {
  it('gives each field only what the larger ones left it', () => {
    // Four days, six hours, twelve minutes and half a minute
    const span = 4 * 86_400_000 + 6 * 3_600_000 + 12 * 60_000 + 30_000

    // Each field holds its own share and none of the one above it
    expect(splitRemaining(span)).toEqual({ days: 4, hours: 6, minutes: 12, seconds: 30 })
  })

  it('leaves a field at zero rather than borrowing from the one above', () => {
    // Exactly two days, so everything below it is empty
    expect(splitRemaining(2 * 86_400_000)).toEqual({
      days: 2,
      hours: 0,
      minutes: 0,
      seconds: 0,
    })
  })

  it('truncates a part-second rather than rounding it up', () => {
    // 59.9s is still 59 seconds left, never the minute it nearly is
    expect(splitRemaining(59_900)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 })
  })

  it('stops at zero rather than counting past it', () => {
    // A deadline read after it passed
    expect(splitRemaining(-90_000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
