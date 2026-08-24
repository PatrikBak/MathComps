'use client'

import { useSearchParams } from 'next/navigation'

import { ROUTES } from '@/i18n/i18n'

/**
 * What the mocked backend reads its whole identity from, carried across every way into the surface.
 *
 * Dropped, the next page answers as a different student who never entered anything, which reads as a broken
 * guard rather than as a lost query parameter. It goes when the mocked service does.
 */
type ScenarioQuery = {
  /** Which set of facts to read the page under, absent where the address carries none. */
  scenario?: string
}

/**
 * The way into one competition's own area, named the way a localized route has to be named: by the route
 * and its values rather than by a path already built out of them. A built path matches no route, so it is
 * carried through as itself and the reader reaches `/sutaze/…` only by being redirected off the English one.
 */
type CompetitionAreaHref = {
  /** The route, dynamic segment and all. */
  pathname: typeof ROUTES.COMPETITION_AREA
  /** What fills that segment. */
  params: {
    /** Which competition's area. */
    id: string
  }
  /** What the address is carrying. */
  query: ScenarioQuery
}

/**
 * The way back to the list of competitions, named by its route for the same reason the area is.
 */
type CompetitionsListHref = {
  /** The route. */
  pathname: typeof ROUTES.COMPETITIONS
  /** What the address is carrying. */
  query: ScenarioQuery
}

/**
 * Reads the scenario the page is being read under.
 *
 * @returns The query to carry on, empty where the address names no scenario.
 */
function useScenarioQuery(): ScenarioQuery {
  // Whatever the address currently carries
  const searchParams = useSearchParams()

  // The scenario it is being read under, if any
  const scenario = searchParams?.get('scenario')

  // Which rides along, or nothing does
  return scenario === null || scenario === undefined ? {} : { scenario }
}

/**
 * Builds the way into one competition's own area.
 *
 * @returns A function naming the area of whichever competition it is asked about.
 */
export function useCompetitionAreaHref(): (competitionId: string) => CompetitionAreaHref {
  // What the address is carrying
  const query = useScenarioQuery()

  // A function which names one competition's area, under whatever the address is carrying
  return (competitionId) => ({
    pathname: ROUTES.COMPETITION_AREA,
    params: { id: competitionId },
    query,
  })
}

/**
 * Builds the way back to the list of competitions.
 *
 * @returns The list's address.
 */
export function useCompetitionsListHref(): CompetitionsListHref {
  // What the address is carrying
  const query = useScenarioQuery()

  // The list, carrying the scenario the address had
  return { pathname: ROUTES.COMPETITIONS, query }
}
