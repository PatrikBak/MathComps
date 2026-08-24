'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * How the floating panel both selects open is dressed. Where it goes and how big it may be is
 * `useSelectPanel`'s, written onto the element as it moves.
 *
 * The scroll padding matches the real one, so scrolling a row into view stops short of the panel's edge
 * rather than parking the row above it half cut off.
 */
export const SELECT_PANEL_CLASS_NAME =
  'scrollbar-visible z-floating overflow-y-auto rounded-lg border border-foreground/10 bg-surface/95 p-0.5 sm:p-1 scroll-p-0.5 sm:scroll-p-1 shadow-2xl backdrop-blur'

/**
 * How a choice reads inside the panel.
 */
export const SELECT_OPTION_LABEL_CLASS_NAME = 'text-xs sm:text-sm font-medium text-foreground'

/**
 * What a placeholder looks like.
 *
 * Native inputs get this from `.form-input::placeholder`; a button standing in for one has to say it.
 */
export const SELECT_PLACEHOLDER_CLASS_NAME = 'text-muted/40'

/**
 * The state a panel row is rendered in.
 */
type SelectOptionState = {
  /** Whether the row is the picked one. */
  selected: boolean
  /** Whether the row currently has focus. */
  focus: boolean
}

/**
 * Dresses one row of the panel.
 *
 * @param state - The state the row is rendered in.
 *
 * @returns The row's classes.
 */
export function getSelectOptionClassName({ selected, focus }: SelectOptionState): string {
  return cn(
    'flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors cursor-pointer',
    focus && 'bg-foreground/5',
    selected && 'bg-focus/10 ring-1 ring-inset ring-focus/30'
  )
}

/**
 * Props of {@link SelectChevron}.
 */
type SelectChevronProps = {
  /** Whether the panel is open. */
  open: boolean
}

/**
 * The arrow saying which way the panel will go.
 */
export function SelectChevron({ open }: SelectChevronProps) {
  // The arrow pointing the way the panel will go
  const Chevron = open ? ChevronUp : ChevronDown

  return <Chevron className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
}
