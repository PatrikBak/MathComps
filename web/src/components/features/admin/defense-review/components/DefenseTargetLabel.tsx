'use client'

import { useTranslations } from 'next-intl'

import { ENVIRONMENT_TEXT_COLOR } from '@/components/features/handouts/handout-colors'
import {
  type HandoutProblemRefEmphasis,
  HandoutProblemRefLabel,
} from '@/components/features/handouts/HandoutProblemRefLabel'
import { HandoutProblemRefLink } from '@/components/features/handouts/HandoutProblemRefLink'
import { useHandoutProblemLabel } from '@/components/features/handouts/use-handout-problem-label'
import { describeProblemRef } from '@/components/features/problems/problem-ref-label'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import type { DefenseReviewHandoutTarget, DefenseReviewTarget } from '../model/defense-review-types'

/** What each weight makes of the competition's name. */
const ARCHIVE_EMPHASIS_CLASS = {
  muted: 'text-muted',
  strong: 'font-medium text-foreground',
} satisfies Record<HandoutProblemRefEmphasis, string>

/**
 * Props for the {@link DefenseTargetLabel} and {@link DefenseTargetRef} components.
 */
type DefenseTargetProps = {
  /** The problem being named. */
  target: DefenseReviewTarget
  /** How much weight what holds the problem is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Props for the {@link HandoutTarget} component.
 */
type HandoutTargetProps = {
  /** The handout problem being named. */
  target: DefenseReviewHandoutTarget
  /** How much weight the handout's title is given. */
  emphasis: HandoutProblemRefEmphasis
  /** Whether to render it as the way to go and read the problem rather than as the line alone. */
  asLink: boolean
}

/**
 * Names a handout problem. A component of its own because naming one reads handout content through a hook,
 * which the arm of a switch cannot do.
 */
function HandoutTarget({ target, emphasis, asLink }: HandoutTargetProps) {
  // Review-surface copy
  const t = useTranslations('admin.defenseReview')

  // Which problem of which handout it was held against
  const label = useHandoutProblemLabel(target, t('deletedHandout'))

  // A tab away wherever the site still carries it
  if (asLink) return <HandoutProblemRefLink label={label} emphasis={emphasis} />

  // Or the line alone
  return <HandoutProblemRefLabel label={label} emphasis={emphasis} />
}

/**
 * Which problem a conversation was held against, whichever kind of problem that is.
 *
 * An archive problem's parts carry different weights. What the competition sits under gives way first when
 * the line runs out of room, since every problem out of one archive shares most of it. The problem itself is
 * coloured the way the handout pages colour a problem, so a line naming an archive problem and one naming a
 * handout problem read as the same kind of thing.
 *
 * It brings no row of its own so that a caller can set the text size and put whatever else belongs on the
 * line beside it.
 */
export function DefenseTargetLabel({ target, emphasis }: DefenseTargetProps) {
  // Handout-surface copy, which is where what a problem is called already lives
  const tHandouts = useTranslations('handouts')

  // Name it per kind, since the two are named from different places
  switch (target.kind) {
    // A handout problem, named from content the reader's own side holds
    case 'handout':
      return <HandoutTarget target={target} emphasis={emphasis} asLink={false} />

    // An archive problem, which arrives already named: where it was set, when, and which problem of it
    case 'problem': {
      // The three parts it reads in
      const label = describeProblemRef(target.source, tHandouts('environments.problem'))

      return (
        <>
          {label.context.map((level) => (
            <span key={level} className="hidden truncate text-muted/70 sm:inline">
              {level}
            </span>
          ))}

          <span className={cn('shrink-0', ARCHIVE_EMPHASIS_CLASS[emphasis])}>{label.edition}</span>

          <span className={cn('shrink-0', ENVIRONMENT_TEXT_COLOR.problem)}>{label.problem}</span>
        </>
      )
    }

    // An arm nothing here knows
    default:
      return assertNever(target)
  }
}

/**
 * Which problem a conversation was held against, as its own row and as the way to go and read it where there
 * is one. An archive problem has none while its competition is still under embargo, so it reads as the plain
 * line instead.
 */
export function DefenseTargetRef({ target, emphasis }: DefenseTargetProps) {
  // The handout arm is the only one anything on the site can send the reader to
  if (target.kind === 'handout') {
    return <HandoutTarget target={target} emphasis={emphasis} asLink />
  }

  // The rest read as the line alone, on a row of their own so they sit where the link's would
  return (
    <span className="flex min-w-0 items-baseline gap-2">
      <DefenseTargetLabel target={target} emphasis={emphasis} />
    </span>
  )
}
