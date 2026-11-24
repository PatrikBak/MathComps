import { describe, expect, it } from 'vitest'

import {
  type DrawnRowControls,
  fitRow,
  placeRowWidths,
  type RowControls,
  type RowMeasures,
} from '../row-fit'

/** Three controls, 100, 80 and 60 wide, 10 apart. */
const MEASURED: Omit<RowMeasures, 'room'> = {
  gap: 10,
  widths: [100, 80, 60],
}

/** The controls of {@link MEASURED}, each free to leave the row. */
const UNPINNED: RowControls = { itemCount: 3, pinnedCount: 0 }

/** The controls of {@link MEASURED}, the last staying on the row however narrow it gets. */
const LAST_PINNED: RowControls = { itemCount: 3, pinnedCount: 1 }

describe('fitRow', () => {
  it('keeps every control while the whole run fits to the pixel, gaps between controls only', () => {
    // Exactly the whole run: three widths and two gaps
    const visibleCount = fitRow({ ...MEASURED, room: 260 }, UNPINNED)

    // Every control
    expect(visibleCount).toBe(3)
  })

  it('drops controls from the last, one at a time, a pixel short of each run', () => {
    // A pixel short of the whole run
    const shortOfThree = fitRow({ ...MEASURED, room: 259 }, UNPINNED)

    // Room for the first two
    expect(shortOfThree).toBe(2)

    // A pixel short of the first two
    const shortOfTwo = fitRow({ ...MEASURED, room: 189 }, UNPINNED)

    // Room for the first alone
    expect(shortOfTwo).toBe(1)
  })

  it('keeps a pinned control on the row and drops the others from the last before it', () => {
    // A pixel short of the whole run, the pinned control last in it
    const visibleCount = fitRow({ ...MEASURED, room: 259 }, LAST_PINNED)

    // The second of the two that can leave goes, the first keeping its place before the pinned one
    expect(visibleCount).toBe(1)
  })

  it('stands every control on the row while any width is unknown, so that it can be measured', () => {
    // Nothing measured yet
    const unmeasured = fitRow(null, UNPINNED)

    // Every control
    expect(unmeasured).toBe(3)

    // A control not measured yet, in a row too narrow for the ones that were
    const partlyMeasured = fitRow(
      { ...MEASURED, widths: [100, undefined, 60], room: 120 },
      UNPINNED
    )

    // Every control
    expect(partlyMeasured).toBe(3)
  })
})

/** Five controls, the last pinned, with the first two of the others on screen before it. */
const TWO_OF_FOUR_DRAWN: DrawnRowControls = { itemCount: 5, pinnedCount: 1, visibleCount: 2 }

describe('placeRowWidths', () => {
  it('places the pinned control past the ones off screen, which keep their last widths', () => {
    // The two controls on screen and the pinned one, measured anew, over every width as last measured
    const widths = placeRowWidths([100, 80, 50], TWO_OF_FOUR_DRAWN, [101, 81, 70, 60, 51])

    // The new widths in their places, the two off screen as they were
    expect(widths).toEqual([100, 80, 70, 60, 50])
  })

  it('leaves a control unknown that has never stood on the row', () => {
    // The row's first measuring, with only some controls on screen
    const widths = placeRowWidths([100, 80, 50], TWO_OF_FOUR_DRAWN, null)

    // The controls off screen have no width yet
    expect(widths).toEqual([100, 80, undefined, undefined, 50])
  })
})
