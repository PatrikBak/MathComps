/**
 * What the year picker holds when somebody says they are past high school, which is not a year.
 */
export const PAST_SCHOOL_VALUE = 'past-school'

/**
 * How far ahead the offered graduation years reach from the current one, which has to cover a prima student
 * with eight years of school left.
 */
const GRADUATION_YEARS_AHEAD = 9

/**
 * The graduation years a student may pick from.
 *
 * Derived from the year it is, so it cannot go stale. It starts at the current year because a year already
 * behind us describes somebody who answers {@link PAST_SCHOOL_VALUE} instead. It bounds only what the form
 * offers.
 *
 * @param currentYear - The year it is now, passed in rather than read so the window can be tested.
 *
 * @returns The years on offer, earliest first.
 */
export function getGraduationYears(currentYear: number): number[] {
  // Every year from this one out to the furthest a student still in school could be sitting
  return Array.from(
    { length: GRADUATION_YEARS_AHEAD + 1 },
    (_unused, offset) => currentYear + offset
  )
}
