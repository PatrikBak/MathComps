'use client'

import { Lightbulb } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment } from 'react'

import { ProseContactLink } from '@/components/features/contact/ProseContactLink'
import { assertNever } from '@/components/shared/utils/assert-never'

import type { HostedCompetitionCategory } from '../model/hosted-competition-types'
import { HOSTED_COMPETITION_CATEGORIES } from '../model/hosted-competition-types'
import { CategoryBadge } from './CategoryBadge'
import { DisclosureNote } from './DisclosureNote'
import { HeaderDisclosure } from './HeaderDisclosure'

/**
 * What the three levels are, said once in the header for every group on the page.
 */
export function CategoryLegend() {
  // Competitions copy
  const t = useTranslations('competitions')

  /**
   * Says who one level is pitched at.
   *
   * @param category - The level being described.
   *
   * @returns Its description.
   */
  function hintFor(category: HostedCompetitionCategory): string {
    switch (category) {
      // The easiest of the three
      case 'elementary':
        return t('categoryHints.elementary')

      // The middle one
      case 'intermediate':
        return t('categoryHints.intermediate')

      // The hardest
      case 'advanced':
        return t('categoryHints.advanced')

      // Every level is handled above
      default:
        return assertNever(category)
    }
  }

  return (
    <HeaderDisclosure label={t('categoryToggle')}>
      {/* One level per line, the badges in a column of their own */}
      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-2.5 text-sm">
        {HOSTED_COMPETITION_CATEGORIES.map((category) => (
          <Fragment key={category}>
            <dt>
              <CategoryBadge category={category} />
            </dt>
            <dd className="text-muted">{hintFor(category)}</dd>
          </Fragment>
        ))}
      </dl>

      {/* What the three names on their own would imply the opposite of */}
      <p className="mt-3.5 text-sm text-muted">{t('categoryNote')}</p>

      {/* What else the program might run, and the way to ask for it */}
      <DisclosureNote icon={Lightbulb}>
        {t.rich('categoryFuture', {
          link: (chunks) => <ProseContactLink reason="featureIdeas">{chunks}</ProseContactLink>,
        })}
      </DisclosureNote>
    </HeaderDisclosure>
  )
}
