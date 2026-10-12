'use client'

import { useTranslations } from 'next-intl'

import { DefenseTargetLabel } from '@/components/features/defense/components/DefenseTargetLabel'
import type {
  NamedDefenseTarget,
  NamedHandoutTarget,
} from '@/components/features/defense/model/defense-types'
import type { HandoutProblemRefEmphasis } from '@/components/features/handouts/HandoutProblemRefLabel'
import { HandoutProblemRefLink } from '@/components/features/handouts/HandoutProblemRefLink'
import { useHandoutProblemLabel } from '@/components/features/handouts/use-handout-problem-label'
import { assertNever } from '@/components/shared/utils/assert-never'

/**
 * Props for the {@link DefenseTargetRef} component.
 */
type DefenseTargetRefProps = {
  /** The problem being named. */
  target: NamedDefenseTarget
  /** How much weight what holds the problem is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Props for the {@link HandoutTargetLink} component.
 */
type HandoutTargetLinkProps = {
  /** The handout problem being pointed at. */
  target: NamedHandoutTarget
  /** How much weight the handout's title is given. */
  emphasis: HandoutProblemRefEmphasis
}

/**
 * Points at a handout problem. A component of its own because naming one reads handout content through a
 * hook, which a branch cannot do.
 */
function HandoutTargetLink({ target, emphasis }: HandoutTargetLinkProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Which problem of which handout it was held against
  const label = useHandoutProblemLabel(target, t('deletedHandout'))

  // A tab away wherever the site still carries it
  return <HandoutProblemRefLink label={label} emphasis={emphasis} />
}

/**
 * Which problem a conversation was held against, as its own row: a link for a handout problem, the plain line
 * for an archive one or a proposal.
 */
export function DefenseTargetRef({ target, emphasis }: DefenseTargetRefProps) {
  // Point at the problem the way its kind is reached
  switch (target.kind) {
    // The handout arm is the only one anything on the site can send the reader to
    case 'handout':
      return <HandoutTargetLink target={target} emphasis={emphasis} />

    // The rest read as the line alone, on a row of their own so they sit where the link's would
    case 'problem':
    case 'proposal':
      return (
        <span className="flex min-w-0 items-baseline gap-2">
          <DefenseTargetLabel target={target} emphasis={emphasis} />
        </span>
      )

    // An arm nothing here knows
    default:
      return assertNever(target)
  }
}
