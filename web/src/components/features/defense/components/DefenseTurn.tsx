'use client'

import { useReducedMotion } from '@mantine/hooks'
import { useState } from 'react'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'

import type { Turn, TurnRole } from '../model/defense-types'

/**
 * Props for a single {@link DefenseTurn}.
 */
type DefenseTurnProps = {
  /** The message this turn renders. */
  turn: Turn
  /** The localized role label shown above the message. */
  label: string
  /** Whether this turn just arrived and should fade in. */
  animate: boolean
}

/**
 * The per-role look of a turn: the examiner reads as a plain annotated block, the student as a tinted
 * card, distinguished by tint and alignment.
 */
type TurnStyle = {
  /** Classes for the turn's outer container. */
  container: string
  /** Classes for the role label. */
  label: string
  /** Classes for the message body: the examiner speaks in the serif math voice, the student in sans. */
  body: string
}

/** The container/label/body styling for each role. */
const TURN_STYLES: Record<TurnRole, TurnStyle> = {
  examiner: {
    container: 'border-l-2 border-foreground/15 pl-4',
    label: 'text-muted',
    body: 'math-typography',
  },
  student: {
    container: 'self-end rounded-xl bg-brand/10 px-3.5 py-3',
    label: 'text-brand-light',
    body: 'text-[15px] leading-relaxed',
  },
}

/**
 * Renders one message of a defense conversation, styled by who authored it, with its body rendered as
 * read-only rich math.
 */
export function DefenseTurn({ turn, label, animate }: DefenseTurnProps) {
  // The look for this turn's author
  const style = TURN_STYLES[turn.role]

  // Whether the viewer asked to minimize motion
  const reducedMotion = useReducedMotion()

  // The entrance animation as decided at mount, so a transcript reconcile mid-fade can't cut it short
  const [entranceAnimation] = useState(animate)

  return (
    <div
      className={cn(
        'max-w-[85%] space-y-1.5',
        style.container,
        entranceAnimation &&
          !reducedMotion &&
          'animate-in fade-in slide-in-from-bottom-2 duration-300'
      )}
    >
      {/* Who authored the turn */}
      <div className={cn('text-[11px] font-bold uppercase tracking-wide', style.label)}>
        {label}
      </div>

      {/* The message body as read-only rich math */}
      <div className={style.body}>
        <RichMathEditorRenderer content={turn.content} lightImageBackground={false} />
      </div>
    </div>
  )
}
