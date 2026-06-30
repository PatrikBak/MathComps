/**
 * The "roomy" viewport for the guide filter bar: wide enough (≥640px) and tall enough (>600px) that
 * the filter grid can stay open inline without costing meaningful vertical space. Below either
 * threshold — a narrow phone, or a short landscape phone — the grid collapses behind a toggle.
 *
 * Tailwind needs each full arbitrary-variant class to appear verbatim to generate it, so the two
 * sides of this pair spell out the same media query rather than deriving it from a shared piece.
 */

/** Forces the filter grid visible on a roomy viewport. */
export const ROOMY_VISIBLE = '[@media(min-width:640px)_and_(min-height:601px)]:block'

/** Hides the compact toggle header on a roomy viewport. */
export const ROOMY_HIDDEN = '[@media(min-width:640px)_and_(min-height:601px)]:hidden'
