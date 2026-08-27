import type { ProblemSource } from './types/problem-api-types'

/**
 * An archive problem as it is named on screen, split into the parts a line can weight or drop separately.
 */
export type ProblemRefLabel = {
  /**
   * Everything the competition sits under, outermost first; empty for one sitting under nothing. It stays a
   * list because it is context rather than the name, so a line showing it puts its own gap between the levels
   * instead of carrying a separator the shallow chains would have nothing to use.
   */
  context: string[]
  /**
   * The competition itself and the years it ran across, e.g. "September 2026/2027". The two belong together:
   * a competition runs again every year under the same name, so neither half names one run on its own.
   */
  edition: string
  /** Which problem of that run it is, e.g. "Problem 2". */
  problem: string
}

/**
 * Names an archive problem: where it was set, when, and which problem of it.
 *
 * The season reads as its two calendar years rather than under its own label, which spells out an edition
 * number. That number counts one competition's own editions and every competition in the season borrows it,
 * so it says nothing true about most of them.
 *
 * @param source - Where the problem comes from.
 * @param problemWord - What this surface calls a problem, e.g. "Problem".
 *
 * @returns The problem as it reads.
 */
export function describeProblemRef(source: ProblemSource, problemWord: string): ProblemRefLabel {
  // The competition it was set in, which the chain names last
  const competition = source.competition.at(-1)

  // What that competition sits under, which is the rest of the chain
  const context = source.competition.slice(0, -1).map((ancestor) => ancestor.displayName)

  // The years the season ran across
  const years = `${source.startYear}/${source.startYear + 1}`

  // The problem as it reads
  return {
    context,
    edition: competition === undefined ? years : `${competition.displayName} ${years}`,
    problem: `${problemWord} ${source.number}`,
  }
}
