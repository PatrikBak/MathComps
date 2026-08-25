import { ROUTES } from '@/i18n/i18n'

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
