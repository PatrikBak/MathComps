'use client'

import { useTranslations } from 'next-intl'

import { ENVIRONMENT_TEXT_COLOR } from '@/components/features/handouts/handout-colors'
import {
  type HandoutProblemRefEmphasis,
  HandoutProblemRefLabel,
} from '@/components/features/handouts/HandoutProblemRefLabel'
import { useHandoutProblemLabel } from '@/components/features/handouts/use-handout-problem-label'
import { describeProblemRef } from '@/components/features/problems/problem-ref-label'
import { assertNever } from '@/components/shared/utils/assert-never'
import { cn } from '@/components/shared/utils/css-utils'

import type { NamedDefenseTarget, NamedHandoutTarget } from '../model/defense-types'

/** What each weight makes of the competition's name. */
const ARCHIVE_EMPHASIS_CLASS = {
  muted: 'text-muted',
  strong: 'font-medium text-foreground',
} satisfies Record<HandoutProblemRefEmphasis, string>

/**
 * Props for the {@link DefenseTargetLabel} component.
 */
type DefenseTargetLabelProps = {
  /** The problem being named. */
  target: NamedDefenseTarget
  /** How much weight what holds the problem is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Props for the {@link HandoutTarget} component.
 */
type HandoutTargetProps = {
  /** The handout problem being named. */
  target: NamedHandoutTarget
  /** How much weight the handout's title is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Names a handout problem. A component of its own because naming one reads handout content through a hook,
 * which the arm of a switch cannot do.
 */
function HandoutTarget({ target, emphasis }: HandoutTargetProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Which problem of which handout it was held against
  const label = useHandoutProblemLabel(target, t('deletedHandout'))

  // Which handout it was set in and which problem of it, on one line
  return <HandoutProblemRefLabel label={label} emphasis={emphasis} />
}

/**
 * Which problem a conversation was held against, whichever kind of problem that is.
 *
 * An archive problem's parts carry different weights. Which problem it was is the half that tells two of
 * these apart, so it holds its width while the competition's own name wraps or gives way as the room runs
 * out. The problem is coloured the way the handout pages colour a problem, so a line naming an archive
 * problem and one naming a handout problem read as the same kind of thing.
 *
 * It brings no row of its own so that a caller can set the text size and put whatever else belongs on the
 * line beside it.
 */
export function DefenseTargetLabel({ target, emphasis }: DefenseTargetLabelProps) {
  // Handout-surface copy
  const tHandouts = useTranslations('handouts')

  // Name it per kind, since the two are named from different places
  switch (target.kind) {
    // A handout problem, named from content the reader's own side holds
    case 'handout':
      return <HandoutTarget target={target} emphasis={emphasis} />

    // An archive problem, which arrives already named: where it was set, when, and which problem of it
    case 'problem': {
      // The three parts it reads in
      const label = describeProblemRef(target.source, tHandouts('environments.problem'))

      return (
        <>
          {/* What the competition sits under, one level per span so the line drops them narrow */}
          {label.context.map((level) => (
            <span key={level} className="hidden truncate text-muted/70 sm:inline">
              {level}
            </span>
          ))}

          {/* The competition and which run of it */}
          <span className={cn('min-w-0', ARCHIVE_EMPHASIS_CLASS[emphasis])}>{label.edition}</span>

          {/* Which problem of that run */}
          <span className={cn('shrink-0', ENVIRONMENT_TEXT_COLOR.problem)}>{label.problem}</span>
        </>
      )
    }

    // An arm nothing here knows
    default:
      return assertNever(target)
  }
}
