import type { Messages } from 'next-intl'

import type { DefenseOutcome, DefenseReportCategory } from './defense-types'

/**
 * Union of the `outcomes.*` message keys, valid inside the `defense` namespace.
 */
type OutcomeLabelKey = `outcomes.${string & keyof Messages['defense']['outcomes']}`

/**
 * Union of the `reportCategories.*` message keys, valid inside the `defense` namespace.
 */
type ReportCategoryLabelKey =
  `reportCategories.${string & keyof Messages['defense']['reportCategories']}`

/**
 * The message key naming each way an examiner reply can go wrong, in the order they are offered.
 */
export const REPORT_CATEGORY_KEYS = {
  misunderstood: 'reportCategories.misunderstood',
  saidSomethingWrong: 'reportCategories.saidSomethingWrong',
  gaveAway: 'reportCategories.gaveAway',
  missedTheMistake: 'reportCategories.missedTheMistake',
  tone: 'reportCategories.tone',
  other: 'reportCategories.other',
} satisfies Record<DefenseReportCategory, ReportCategoryLabelKey>

/**
 * The message key naming each thing the examiner can have done for the student, in the order they are offered.
 */
export const OUTCOME_KEYS = {
  foundTheMistake: 'outcomes.foundTheMistake',
  confirmedTheSolution: 'outcomes.confirmedTheSolution',
  notEnoughHelp: 'outcomes.notEnoughHelp',
  wasOff: 'outcomes.wasOff',
  somethingElse: 'outcomes.somethingElse',
} satisfies Record<DefenseOutcome, OutcomeLabelKey>
