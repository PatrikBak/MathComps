import type { DisclosureAccent } from '@/components/shared/components/DisclosurePanel'

import type { HandoutEnvironmentType } from './handout-content-types'

export type { HandoutEnvironmentType }

/** Color classes for a card's border, title, and summary text. */
type CardPaletteEntry = {
  /** Left border accent (e.g., `border-green-500`). */
  border: string
  /** Title text color (e.g., `text-green-300`). */
  title: string
  /** Summary/details text color, typically matches the title. */
  summary: string
}

/**
 * Card-level colors used for borders, titles, and summaries.
 */
export const CARD_PALETTE: Record<HandoutEnvironmentType, CardPaletteEntry> = {
  theorem: {
    border: 'border-green-500',
    title: 'text-green-300',
    summary: 'text-green-300',
  },
  exercise: {
    border: 'border-yellow-500',
    title: 'text-yellow-300',
    summary: 'text-yellow-300',
  },
  example: {
    border: 'border-blue-500',
    title: 'text-blue-300',
    summary: 'text-blue-300',
  },
  problem: {
    border: 'border-purple-500',
    title: 'text-purple-300',
    summary: 'text-purple-300',
  },
  definition: {
    border: 'border-orange-500',
    title: 'text-orange-300',
    summary: 'text-orange-300',
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
  definition: 'text-orange-300',
}

/**
 * How each environment's own collapsible row reads: its proof, or its solution. The hint and answer rows
 * cut across every environment and carry accents of their own ({@link HINT_ACCENT}, {@link ANSWER_ACCENT}).
 */
export const ENVIRONMENT_ACCENT: Record<HandoutEnvironmentType, DisclosureAccent> = {
  theorem: {
    textColorClass: ENVIRONMENT_TEXT_COLOR.theorem,
    badge: {
      text: 'text-green-200',
      bg: 'bg-green-500/15',
      border: 'border-green-400/20',
    },
  },
  exercise: {
    textColorClass: ENVIRONMENT_TEXT_COLOR.exercise,
    badge: {
      text: 'text-yellow-200',
      bg: 'bg-yellow-500/15',
      border: 'border-yellow-400/20',
    },
  },
  example: {
    textColorClass: ENVIRONMENT_TEXT_COLOR.example,
    badge: {
      text: 'text-blue-200',
      bg: 'bg-blue-500/15',
      border: 'border-blue-400/20',
    },
  },
  problem: {
    textColorClass: ENVIRONMENT_TEXT_COLOR.problem,
    badge: {
      text: 'text-purple-200',
      bg: 'bg-purple-500/15',
      border: 'border-purple-400/20',
    },
  },
  definition: {
    textColorClass: ENVIRONMENT_TEXT_COLOR.definition,
    badge: {
      text: 'text-orange-200',
      bg: 'bg-orange-500/15',
      border: 'border-orange-400/20',
    },
  },
}

/**
 * Tailwind color classes for the surround applied to a highlighted paragraph
 * — gradient tint plus border accent.
 */
export const HIGHLIGHTED_PARAGRAPH_CLASSES =
  'border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 to-pink-500/10'

/**
 * How a hint's collapsible row reads, whichever environment it hangs off.
 */
export const HINT_ACCENT: DisclosureAccent = {
  textColorClass: 'text-yellow-300',
  badge: {
    text: 'text-yellow-200',
    bg: 'bg-yellow-500/15',
    border: 'border-yellow-400/20',
  },
}

/**
 * How an answer's collapsible row reads, whichever environment it hangs off.
 */
export const ANSWER_ACCENT: DisclosureAccent = {
  textColorClass: 'text-teal-300',
  badge: {
    text: 'text-teal-200',
    bg: 'bg-teal-500/15',
    border: 'border-teal-400/20',
  },
}
