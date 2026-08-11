import { describe, expect, it } from 'vitest'

import { formatDurationMs } from '../duration-utils'

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
