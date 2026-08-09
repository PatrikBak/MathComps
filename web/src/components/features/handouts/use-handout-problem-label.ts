'use client'

import { useLocale, useTranslations } from 'next-intl'

import type { Locale } from '@/i18n/i18n'

import type { HandoutEnvironmentTarget } from './handout-metadata-types'
import { describeHandoutProblem, type HandoutProblemLabel } from './handout-problem-label'
import { buildEnvironmentLabels } from './handout-utils'

/**
 * Names a handout problem in the language the reader is reading in.
 *
 * @param target - The handout environment to name.
 * @param deletedHandoutLabel - What this surface calls a handout that is gone from the site.
 *
 * @returns The problem as it reads.
 */
export function useHandoutProblemLabel(
  target: HandoutEnvironmentTarget,
  deletedHandoutLabel: string
): HandoutProblemLabel {
  // Handout-surface copy
  const tHandouts = useTranslations('handouts')

  // The active locale
  const locale = useLocale() as Locale

  // The problem as it reads
  return describeHandoutProblem(target, {
    environmentLabels: buildEnvironmentLabels(tHandouts),
    deletedHandoutLabel,
    locale,
  })
}
