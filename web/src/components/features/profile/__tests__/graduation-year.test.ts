import { describe, expect, it } from 'vitest'

import { getGraduationYears } from '../graduation-year'

describe('getGraduationYears', () => {
  // A year already behind us belongs to somebody past school, who says so outright instead
  it('starts at the current year', () => {
    expect(getGraduationYears(2026)[0]).toBe(2026)
  })

  // And it reaches far enough ahead for a prima student with eight years of school left
  it('ends nine years after the current one', () => {
    expect(getGraduationYears(2026).at(-1)).toBe(2035)
  })

  // Every year in between is offered, with none repeated or skipped
  it('offers every year in the window, earliest first', () => {
    const years = getGraduationYears(2026)
    expect(years).toHaveLength(10)
    expect(years).toStrictEqual([...years].sort((first, second) => first - second))
    expect(new Set(years).size).toBe(years.length)
  })

  // The window moves with the calendar rather than being pinned to any particular year
  it('moves with the year it is given', () => {
    expect(getGraduationYears(2030)[0]).toBe(2030)
  })
})
