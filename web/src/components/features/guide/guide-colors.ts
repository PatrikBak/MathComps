import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'

/**
 * Domain-specific categorical colors and visual effects for the Guide feature.
 * Provides a single vocabulary for guide-specific categorizations like school levels
 * and completion states.
 */

/**
 * Colors associated with school levels.
 */
export const SCHOOL_LEVEL_COLORS = {
  elementary: ACCENT_COLOR_MAP.blue.text,
  highSchool: ACCENT_COLOR_MAP.amber.text,
} as const

/**
 * Colors and visual styles associated with checking off or completing sections
 * of a guide (e.g., beginner checklist or final note badges).
 */
export const COMPLETION_ACCENT = {
  icon: ACCENT_COLOR_MAP.emerald.text,
} as const

/**
 * Visual effects for the Math Olympiad section.
 */
export const OLYMPIAD_GLOW_PALETTE = {
  containerBorder: 'border-sky-500/20',
  glowBg: 'bg-sky-500/5',
} as const

/**
 * Variants for the tip box component.
 */
export const TIP_BOX_VARIANTS = {
  note: 'border-blue-500/20 from-blue-500/5 to-blue-600/5',
  tip: 'border-amber-500/20 from-amber-500/5 to-amber-600/5',
} as const
