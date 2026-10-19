'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { describeUser } from '@/components/features/profile/model/user-identity'

import { averageScore } from '../model/selection-state'
import type { ProposalRating, RatingAspect } from '../model/selection-types'

/** A score as the selection shows it: always to a tenth, the scale's step, and an average to a hundredth. */
export const SCORE_FORMAT = { minimumFractionDigits: 1, maximumFractionDigits: 2 } as const

/**
 * Props for the {@link RatingBreakdown} component.
 */
type RatingBreakdownProps = {
  /** The problem's ratings, at least one scoring an aspect shown. */
  ratings: readonly ProposalRating[]
  /** The aspects shown, in the order their columns read. */
  aspects: readonly RatingAspect[]
}

/**
 * Who rated a problem and how, as a small table: a row per reviewer who scored any aspect shown, with the score they
 * gave each, then the average of each aspect over the reviewers who scored it.
 */
export function RatingBreakdown({ ratings, aspects }: RatingBreakdownProps) {
  // Rating copy
  const t = useTranslations('problemSelection.ratings')

  // Profile copy
  const tProfile = useTranslations('profile')

  // The ratings scoring an aspect shown
  const shown = ratings.filter((rating) => aspects.some((aspect) => rating[aspect] !== null))

  return (
    <table className="border-collapse text-xs hyphens-none">
      {/* The aspects */}
      <thead>
        <tr className="text-muted">
          <th className="pr-3 text-left font-medium">
            <span className="sr-only">{t('name')}</span>
          </th>
          {aspects.map((aspect) => (
            <th key={aspect} className="px-1.5 text-right font-medium">
              {t(aspect)}
            </th>
          ))}
        </tr>
      </thead>

      {/* A row per reviewer */}
      <tbody>
        {shown.map((rating) => (
          <tr key={rating.rater.id}>
            <th scope="row" className="pr-3 text-left font-normal">
              {describeUser(rating.rater, tProfile('defaultUser'))}
            </th>
            {aspects.map((aspect) => (
              <td key={aspect} className="px-1.5 text-right tabular-nums">
                {rating[aspect] === null ? <NoScore /> : <Score score={rating[aspect]} />}
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
          {aspects.map((aspect) => {
            // The aspect's average, none while nobody has scored it
            const average = averageScore(shown, aspect)

            return (
              <td key={aspect} className="px-1.5 pt-0.5 text-right font-semibold tabular-nums">
                {average === null ? <NoScore /> : <Score score={average} />}
              </td>
            )
          })}
        </tr>
      </tfoot>
    </table>
  )
}

/**
 * Props for the {@link Score} component.
 */
type ScoreProps = {
  /** The score, one reviewer's or an average. */
  score: number
}

/**
 * A score, in the reader's language and rounded for reading.
 */
export function Score({ score }: ScoreProps) {
  // Numbers in the reader's language
  const format = useFormatter()

  // The score, rounded for reading
  return format.number(score, SCORE_FORMAT)
}

/**
 * The mark standing in for a missing number.
 */
export function NoScore() {
  // A faint dash in the score's place
  return <span className="text-muted/50">–</span>
}
