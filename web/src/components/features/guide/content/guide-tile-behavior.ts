/**
 * A guide tile's interaction model, derived purely from how much content the entity carries.
 */
export type TileBehavior = 'modal' | 'link' | 'static'

/**
 * Classify a guide entity's tile behavior from its content counts: overflow detail bullets or a choice
 * of several links earn a modal; a lone link makes the whole tile navigate; nothing leaves it static.
 * The single source of truth for the behavior an entity's content earns.
 *
 * @param detailCount How many overflow detail bullets the entity has.
 * @param linkCount How many official links the entity has.
 * @returns Which tile behavior the entity resolves to.
 */
export function tileBehavior(detailCount: number, linkCount: number): TileBehavior {
  // Bullets or a multi-link chooser grow a modal
  if (detailCount > 0 || linkCount > 1) return 'modal'
  // A lone link makes the whole tile a navigating link
  if (linkCount === 1) return 'link'
  // Otherwise it's a plain, non-interactive card
  return 'static'
}
