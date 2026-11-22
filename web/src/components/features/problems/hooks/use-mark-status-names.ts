import { useTranslations } from 'next-intl'

import type { MarkStatusFilter } from '../types/problem-api-types'

/**
 * The name of each mark status a filter can narrow to.
 *
 * @returns The names, by status.
 */
export function useMarkStatusNames(): Record<MarkStatusFilter, string> {
  // Translations for the filters
  const tFilters = useTranslations('problems.filters')

  // Each status, named
  return {
    marked: tFilters('markStatusMarked'),
    unmarked: tFilters('markStatusUnmarked'),
  }
}
