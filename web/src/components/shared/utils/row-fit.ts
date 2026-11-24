/**
 * What a row of controls has measured of itself.
 */
export type RowMeasures = {
  /** The width the row has for its controls. */
  room: number
  /** The space the row keeps between neighbouring controls. */
  gap: number
  /** Each control's width, in the controls' order, unknown until the control stood on the row. */
  widths: (number | undefined)[]
}

/**
 * How many controls a row has, and how many at its end are pinned.
 */
export type RowControls = {
  /** How many controls there are. */
  itemCount: number
  /** How many controls at the end stay on the row however narrow it gets. */
  pinnedCount: number
}

/**
 * Which of a row's controls are on screen.
 */
export type DrawnRowControls = RowControls & {
  /** How many of the controls that can leave the row stand on it, counted from the first, before the pinned ones. */
  visibleCount: number
}

/**
 * Places the widths measured of the controls on screen among all of a row's controls, each control off screen
 * keeping the width it had the last time it stood on the row.
 *
 * @param drawnWidths - The widths of the controls on screen, in the order they stand.
 * @param drawn - Which controls are on screen.
 * @param lastWidths - Every control's width as last measured, null before the row measured anything.
 * @returns Every control's width, in the controls' order, unknown for one that never stood on the row.
 */
export function placeRowWidths(
  drawnWidths: number[],
  drawn: DrawnRowControls,
  lastWidths: (number | undefined)[] | null
): (number | undefined)[] {
  // Each drawn control's place among all the controls: the ones that can leave first, then the pinned ones at the end
  const placeOf = (index: number) =>
    index < drawn.visibleCount
      ? index
      : drawn.itemCount - drawn.pinnedCount + (index - drawn.visibleCount)

  // How wide each control on screen is, by its place among all the controls
  const widthsByPlace = new Map(drawnWidths.map((width, index) => [placeOf(index), width]))

  // The ones on screen in their places, and the last known width of each control off it
  return Array.from(
    { length: drawn.itemCount },
    (_unused, place) => widthsByPlace.get(place) ?? lastWidths?.[place]
  )
}

/**
 * Whether two measurings of a row found the same.
 *
 * @param first - One measuring.
 * @param second - Another measuring of the same row.
 * @returns Whether every width, the room and the gap agree.
 */
export function areRowMeasuresEqual(first: RowMeasures, second: RowMeasures): boolean {
  // Two lists of widths agreeing at every place
  const sameWidths = (one: (number | undefined)[], other: (number | undefined)[]) =>
    one.length === other.length && one.every((width, index) => width === other[index])

  // The room, the gap, and the widths
  return (
    first.room === second.room &&
    first.gap === second.gap &&
    sameWidths(first.widths, second.widths)
  )
}

/**
 * Counts how many controls fit side by side, from the first.
 *
 * @param widths - The controls' widths, in their order.
 * @param gap - The space kept between neighbouring controls.
 * @param room - The width they have.
 * @returns How many fit.
 */
function fittingCount(widths: number[], gap: number, room: number): number {
  // How wide the run is up to and including each control, a gap before every one but the first
  const runWidths = widths.reduce<number[]>(
    (runs, width, index) => [...runs, (index === 0 ? 0 : runs[index - 1] + gap) + width],
    []
  )

  // The runs that fit, which are the first ones, since every run is wider than the one before
  return runWidths.filter((runWidth) => runWidth <= room).length
}

/**
 * Decides how many controls keep their place on a row: the pinned ones at its end, and as many of the others as fit
 * beside them, counted from the first, the rest left off it. While any control's width is unknown, every control
 * stands on the row so that it can be measured.
 *
 * @param measures - What the row has measured, or null before it measured anything.
 * @param controls - How many controls there are, and how many of them are pinned.
 * @returns How many of the controls that can leave the row keep their place on it, counted from the first.
 */
export function fitRow(
  measures: RowMeasures | null,
  { itemCount, pinnedCount }: RowControls
): number {
  // How many controls can leave the row
  const unpinnedCount = itemCount - pinnedCount

  // Every control's width, where each one is known
  const widths = Array.from({ length: itemCount }, (_unused, index) => measures?.widths[index])

  // Some width still unknown, so every control on the row, for the measuring
  if (measures === null || widths.some((width) => width === undefined)) return unpinnedCount

  // The widths, every one now known
  const knownWidths = widths as number[]

  // The pinned controls' run, and the gap setting it apart from the controls before it
  const pinnedRun = knownWidths
    .slice(unpinnedCount)
    .reduce((sum, width) => sum + width + measures.gap, 0)

  // As many of the other controls as fit beside the pinned ones, which is every one where they all do
  return fittingCount(knownWidths.slice(0, unpinnedCount), measures.gap, measures.room - pinnedRun)
}
