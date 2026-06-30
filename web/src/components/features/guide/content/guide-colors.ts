/**
 * Domain-specific categorical colors for the Guide feature — the single home for its raw color classes.
 */

import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'

import type { CompetitionKind, ResourceBucket, SchoolLevel } from './guide-content-types'

/**
 * Text accent color per school level.
 */
export const SCHOOL_LEVEL_COLORS = {
  elementary: ACCENT_COLOR_MAP.blue.text,
  highSchool: ACCENT_COLOR_MAP.amber.text,
} as const satisfies Record<SchoolLevel, string>

/**
 * Left-border accent color per school level.
 */
export const SCHOOL_LEVEL_BORDER_COLORS = {
  elementary: ACCENT_COLOR_MAP.blue.borderLeft,
  highSchool: ACCENT_COLOR_MAP.amber.borderLeft,
} as const satisfies Record<SchoolLevel, string>

/**
 * Text accent color per competition kind.
 */
export const COMPETITION_KIND_COLORS = {
  team: ACCENT_COLOR_MAP.cyan.text,
  individual: ACCENT_COLOR_MAP.amber.text,
} as const satisfies Record<CompetitionKind, string>

/**
 * Text accent color per resource bucket.
 */
export const RESOURCE_BUCKET_COLORS = {
  websites: ACCENT_COLOR_MAP.sky.text,
  programs: ACCENT_COLOR_MAP.purple.text,
  youtube: ACCENT_COLOR_MAP.rose.text,
  studyTexts: ACCENT_COLOR_MAP.emerald.text,
} as const satisfies Record<ResourceBucket, string>

/**
 * Border + background tint per callout variant.
 */
export const TIP_BOX_VARIANTS = {
  tip: `${ACCENT_COLOR_MAP.amber.panelBorder} ${ACCENT_COLOR_MAP.amber.panelBg}`,
  brand: 'border-brand/25 bg-brand/5',
} as const
