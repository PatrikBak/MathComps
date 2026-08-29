import type { TurnRole } from '../model/defense-types'

/**
 * The per-role look of a turn: both read as full-width blocks, the examiner as the bare ambient voice
 * and the student as a brand-tinted card, distinguished by tint and font voice. The brand violet is the
 * examiner's own color, so her label carries it and the student's stays neutral.
 */
type TurnStyle = {
  /** Classes for the turn's outer container. */
  container: string
  /**
   * Whether the turn draws a box of its own, rather than sitting bare in the transcript.
   *
   * Also what settles whether it is worth naming its author on screen: the box is what says who wrote it,
   * so a bare turn carries a label and a boxed one would only be repeating itself.
   */
  hasOwnBox: boolean
  /** Classes for the role label. */
  label: string
  /** Classes for the message body: the examiner speaks in the serif math voice, the student in sans. */
  body: string
  /** Classes cancelling the container's own inset, so every turn's controls share one axis. */
  actionsInset: string
}

/** The container/label/body styling for each role. */
export const TURN_STYLES: Record<TurnRole, TurnStyle> = {
  examiner: {
    container: '',
    hasOwnBox: false,
    label: 'text-brand-light',
    body: 'math-typography math-conversation',
    actionsInset: '',
  },
  candidate: {
    container: 'rounded-lg bg-brand/10 px-3.5 py-2',
    hasOwnBox: true,
    label: 'text-muted',
    body: 'text-sm leading-6',
    actionsInset: '-mr-3.5',
  },
}

/** The type scale and weight every turn's role label is set in. */
export const TURN_LABEL_CLASS = 'text-[11px] font-bold uppercase tracking-wide'
