'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { describeUser } from '@/components/features/profile/model/user-identity'

import { averageScore } from '../model/selection-state'
import { type ProposalRating, RATING_ASPECTS } from '../model/selection-types'

/** The most decimals an average shows. */
const AVERAGE_FRACTION_DIGITS = 1

/**
 * Props for the {@link RatingBreakdown} component.
 */
type RatingBreakdownProps = {
  /** The problem's ratings, at least one. */
  ratings: readonly ProposalRating[]
}

/**
 * Who rated a problem and how, as a small table: a row per reviewer with the score they gave each aspect, then the
 * average of each aspect over the reviewers who scored it.
 */
export function RatingBreakdown({ ratings }: RatingBreakdownProps) {
  // Rating copy
  const t = useTranslations('problemSelection.ratings')

  // Profile copy
  const tProfile = useTranslations('profile')

  // Numbers in the reader's language
  const format = useFormatter()

  return (
    <table className="border-collapse text-xs hyphens-none">
      {/* The aspects */}
      <thead>
        <tr className="text-muted">
          <th className="pr-3 text-left font-medium">
            <span className="sr-only">{t('name')}</span>
          </th>
          {RATING_ASPECTS.map((aspect) => (
            <th key={aspect} className="px-1.5 text-right font-medium">
              {t(aspect)}
            </th>
          ))}
        </tr>
      </thead>

      {/* A row per reviewer */}
      <tbody>
        {ratings.map((rating) => (
          <tr key={rating.rater.id}>
            <th scope="row" className="pr-3 text-left font-normal">
              {describeUser(rating.rater, tProfile('defaultUser'))}
            </th>
            {RATING_ASPECTS.map((aspect) => (
              <td key={aspect} className="px-1.5 text-right tabular-nums">
                {rating[aspect] ?? <NoScore />}
              </td>
            ))}
          </tr>
        ))}
      </tbody>

      {/* The averages */}
      <tfoot>
        <tr className="border-t border-foreground/10">
          <th scope="row" className="pt-0.5 pr-3 text-left font-medium">
            {t('average')}
          </th>
          {RATING_ASPECTS.map((aspect) => {
            // The aspect's average, none while nobody has scored it
            const average = averageScore(ratings, aspect)

            return (
              <td key={aspect} className="px-1.5 pt-0.5 text-right font-semibold tabular-nums">
                {average === null ? (
                  <NoScore />
                ) : (
                  format.number(average, { maximumFractionDigits: AVERAGE_FRACTION_DIGITS })
                )}
              </td>
            )
          })}
        </tr>
      </tfoot>
    </table>
  )
}

/**
 * The mark standing in for a missing number, a reviewer's score or an average.
 */
function NoScore() {
  // A faint dash in the score's place
  return <span className="text-muted/50">–</span>
}
