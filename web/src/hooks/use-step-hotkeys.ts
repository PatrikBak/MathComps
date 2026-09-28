import { type HotkeyItem, useHotkeys } from '@mantine/hooks'

import type { UseSteppedSelectionResult } from './use-stepped-selection'

/** The keys that walk a list, one forward and one back. */
export const STEP_KEYS = { next: 'j', previous: 'k' } as const

/**
 * How many dialogs currently stand over the page, counted off the document itself.
 * @returns The number of dialogs on screen.
 */
function countOpenDialogs(): number {
  // Every dialog on screen, which is what each one announces itself as
  return document.querySelectorAll('[role="dialog"]').length
}

/**
 * Walks a list from the keyboard, with the item open or with none open yet, so a session of reading through it
 * never has to begin with a click.
 *
 * A key only walks while nothing stands over the list's own dialog. That dialog is stepped from happily; anything
 * past it was stacked on top, such as a question waiting on an answer, and walking the list out from under
 * one of those answers something nobody asked. Counting the dialogs keeps that true of the next one too.
 *
 * @param selection - The walk the keys move.
 * @param extraShortcuts - Further keys the surface walks the list by, held to the same rule.
 */
export function useStepHotkeys(
  selection: UseSteppedSelectionResult,
  extraShortcuts: HotkeyItem[] = []
): void {
  // A test of whether a key is the reader walking the list or a stray press behind something standing over it
  const canStep = () => countOpenDialogs() <= (selection.openId === null ? 0 : 1)

  // Every key that walks the list, each one heard only while nothing stands in the way
  useHotkeys(
    [
      [STEP_KEYS.next, () => selection.step(1)] satisfies HotkeyItem,
      [STEP_KEYS.previous, () => selection.step(-1)] satisfies HotkeyItem,
      ...extraShortcuts,
    ].map(
      ([key, handler, options]): HotkeyItem => [
        key,
        (event) => canStep() && handler(event),
        options,
      ]
    )
  )
}
