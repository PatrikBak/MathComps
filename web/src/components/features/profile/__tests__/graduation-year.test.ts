import { describe, expect, it } from 'vitest'

import { getGraduationYears } from '../graduation-year'

describe('getGraduationYears', () => {
  // A maturita already behind us keeps its year on offer, so the grade of every past round survives
  it('starts at 2026 however late it is', () => {
    expect(getGraduationYears(2029)[0]).toBe(2026)
  })

  // And it reaches far enough ahead for a prima student with eight years of school left
  it('ends nine years after the current one', () => {
    expect(getGraduationYears(2029).at(-1)).toBe(2038)
  })

  // Every year in between is offered, with none repeated or skipped
  it('offers every year in the window, earliest first', () => {
    const years = getGraduationYears(2029)
    expect(years).toHaveLength(13)
    expect(years).toStrictEqual([...years].sort((first, second) => first - second))
    expect(new Set(years).size).toBe(years.length)
  })
})
