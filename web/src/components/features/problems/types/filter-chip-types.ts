// Types for the chips standing for the values filtered on, and for how a group of them combines

import type { MouseEvent } from 'react'

import type { LogicToggle } from './problem-api-types'

/**
 * One chip standing for a value filtered on.
 */
export type ChipData = {
  /** Identifies the chip among its group. */
  id: string
  /** What the chip reads. */
  displayName: string
  /** The value's name in full. */
  fullName?: string
  /** Acts on a click on the chip, which carries the modifier when the user asks for this value alone. */
  onClick: (event: MouseEvent) => void
}

/**
 * How a group's values combine, and the way to flip that.
 */
export type ChipGroupLogic = {
  /** Whether a problem has to match every value of the group or one of them. */
  mode: LogicToggle
  /** Flips the group to the other way of combining. */
  onModeToggle: () => void
}
