import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'

import type { HandoutSource } from './handout-metadata-types'

/**
 * Tailwind background/text class pair for a {@link HandoutSource} color scheme.
 */
type HandoutSourceColorScheme = {
  /** Background CSS class */
  bg: string
  /** Text color CSS class */
  text: string
}

/**
 * Source badge color scheme per handout source.
 */
export const HANDOUT_SOURCE_COLORS: Record<HandoutSource, HandoutSourceColorScheme> = {
  matikaCesku: ACCENT_COLOR_MAP.indigo,
  events: ACCENT_COLOR_MAP.amber,
}
