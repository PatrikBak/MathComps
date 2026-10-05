/**
 * What the year picker holds, in place of a year, for somebody who finished high school before
 * {@link EARLIEST_GRADUATION_YEAR}.
 */
export const PAST_SCHOOL_VALUE = 'past-school'

/**
 * The earliest graduation year on offer: the maturita of the first school year the competition ran. Anybody who
 * finished before it was past high school at every round, so their exact year would change no grade.
 */
export const EARLIEST_GRADUATION_YEAR = 2026

/**
 * How far ahead the offered graduation years reach from the current one, which has to cover a prima student
 * with eight years of school left.
 */
const GRADUATION_YEARS_AHEAD = 9

/**
 * The graduation years a student may pick from.
 *
 * The start is pinned to {@link EARLIEST_GRADUATION_YEAR}, so a year once saved stays on offer after it passes
 * and every past round still knows the grade it was sat in. The end moves with the year it is.
 *
 * @param currentYear - The year it is now, passed in rather than read so the window can be tested.
 *
 * @returns The years on offer, earliest first.
 */
export function getGraduationYears(currentYear: number): number[] {
  // The furthest a student still in school could be sitting
  const lastYear = currentYear + GRADUATION_YEARS_AHEAD

  // Every year from the first the competition saw out to that one
  return Array.from(
    { length: lastYear - EARLIEST_GRADUATION_YEAR + 1 },
    (_unused, offset) => EARLIEST_GRADUATION_YEAR + offset
  )
}
