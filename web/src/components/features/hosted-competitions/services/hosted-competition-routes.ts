import { ROUTES } from '@/i18n/i18n'

/**
 * The way to the competitions list.
 *
 * Module-level so every render hands out the same object.
 */
export const COMPETITIONS_LIST_HREF = { pathname: ROUTES.COMPETITIONS }

/**
 * The localized-route href shape narrowed to the competition area route, so the only thing a caller fills
 * in is which competition's area it names.
 */
type CompetitionAreaHref = {
  /** The route, dynamic segment and all. */
  pathname: typeof ROUTES.COMPETITION_AREA
  /** What fills that segment. */
  params: {
    /** Which competition's area. */
    id: string
  }
}

/**
 * Builds the way into one competition's own area.
 *
 * @param competitionId - Whose area to name.
 *
 * @returns The href naming that competition's area.
 */
export function competitionAreaHref(competitionId: string): CompetitionAreaHref {
  // The area route, with the competition filling its segment
  return {
    pathname: ROUTES.COMPETITION_AREA,
    params: { id: competitionId },
  }
}

/**
 * The query parameter naming which problem's official solution is open, so that the address bar of an
 * opened solution is a link somebody else can follow straight back to it.
 *
 * Carries the problem's position, so that the address is one a person can read and type. Reordering a set
 * therefore moves an old link to whatever now sits in that place.
 *
 * Inert for a reader the solution is not out for yet: nothing on their page answers to it.
 */
export const SOLUTION_PARAM = 'solution'
