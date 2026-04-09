import type { HandoutEnvironmentType } from './handout-content-types'

export type { HandoutEnvironmentType }

/** Color classes for a card's border, title, accent tint, and summary text. */
type CardPaletteEntry = {
  /** Left border accent (e.g., `border-green-500`). */
  border: string
  /** Title text color (e.g., `text-green-300`). */
  title: string
  /** Subtle border tint for subtitle badges and dividers (e.g., `border-green-500/20`). */
  tint: string
  /** Summary/details text color, typically matches the title. */
  summary: string
}

/** Color classes for a badge's text, background, and border. */
type BadgePaletteEntry = {
  /** Badge text color (e.g., `text-green-200`). */
  text: string
  /** Badge background fill (e.g., `bg-green-500/15`). */
  bg: string
  /** Badge outline border (e.g., `border-green-400/20`). */
  border: string
}

/**
 * Card-level colors used for borders, titles, and accent tints.
 */
export const CARD_PALETTE: Record<HandoutEnvironmentType, CardPaletteEntry> = {
  theorem: {
    border: 'border-green-500',
    title: 'text-green-300',
    tint: 'border-green-500/20',
    summary: 'text-green-300',
  },
  exercise: {
    border: 'border-yellow-500',
    title: 'text-yellow-300',
    tint: 'border-yellow-500/20',
    summary: 'text-yellow-300',
  },
  example: {
    border: 'border-blue-500',
    title: 'text-blue-300',
    tint: 'border-blue-500/20',
    summary: 'text-blue-300',
  },
  problem: {
    border: 'border-purple-500',
    title: 'text-purple-300',
    tint: 'border-purple-500/20',
    summary: 'text-purple-300',
  },
}

/**
 * Text color for environment headings in the detail view
 * (e.g., "Theorem 1", "Exercise 3").
 */
export const ENVIRONMENT_TEXT_COLOR: Record<HandoutEnvironmentType, string> = {
  theorem: 'text-green-300',
  exercise: 'text-yellow-300',
  example: 'text-blue-300',
  problem: 'text-purple-300',
}

/**
 * Badge colors for collapsible section buttons (proof, solution, hint)
 * in the detail view.
 */
export const ENVIRONMENT_BADGE: Record<HandoutEnvironmentType, BadgePaletteEntry> = {
  theorem: {
    text: 'text-green-200',
    bg: 'bg-green-500/15',
    border: 'border-green-400/20',
  },
  exercise: {
    text: 'text-yellow-200',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-400/20',
  },
  example: {
    text: 'text-blue-200',
    bg: 'bg-blue-500/15',
    border: 'border-blue-400/20',
  },
  problem: {
    text: 'text-purple-200',
    bg: 'bg-purple-500/15',
    border: 'border-purple-400/20',
  },
}

/**
 * Text color for hint headings in the detail view.
 */
export const HINT_TEXT_COLOR = 'text-yellow-300'

/**
 * Badge colors for hint toggle buttons in the detail view.
 */
export const HINT_BADGE: BadgePaletteEntry = {
  text: 'text-yellow-200',
  bg: 'bg-yellow-500/15',
  border: 'border-yellow-400/20',
}
