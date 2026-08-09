import { cn } from '@/components/shared/utils/css-utils'

import { ENVIRONMENT_TEXT_COLOR } from './handout-colors'
import type { HandoutProblemLabel } from './handout-problem-label'

/**
 * Props for the {@link HandoutProblemRefLabel} component.
 */
type HandoutProblemRefLabelProps = {
  /** The problem being named. */
  label: HandoutProblemLabel
}

/**
 * Which problem of which handout something was about, as a pair of spans.
 *
 * The handout is what gives way when the line runs out of room: which problem it was is the half that tells
 * two of these apart, and it is coloured by its kind the way the handout pages colour it.
 *
 * It brings no row of its own so that a caller can set the text size and put whatever else belongs on the
 * line beside it.
 */
export function HandoutProblemRefLabel({ label }: HandoutProblemRefLabelProps) {
  return (
    <>
      <span className="truncate text-muted">{label.handoutTitle}</span>

      {label.environment !== null && (
        <span className={cn('shrink-0', ENVIRONMENT_TEXT_COLOR[label.environment.type])}>
          {label.environment.label}
        </span>
      )}
    </>
  )
}
