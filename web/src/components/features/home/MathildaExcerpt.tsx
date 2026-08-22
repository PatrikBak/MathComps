import { useTranslations } from 'next-intl'

import { TURN_LABEL_CLASS, TURN_STYLES } from '@/components/features/defense/components/turn-styles'
import type { TurnRole } from '@/components/features/defense/model/defense-types'
import { MathRendererClient } from '@/components/math/MathRendererClient'
import { SurfacePanel } from '@/components/shared/components/SurfacePanel'
import { cn } from '@/components/shared/utils/css-utils'
import { MATHILDA_NAME } from '@/constants/mathilda'

/**
 * One message of the sample exchange: who speaks, and the key its body is written under.
 */
type ExcerptTurn = {
  /** Who authored the message. */
  role: TurnRole
  /** Translation key for the message body, under `home.mathilda.exchange`. */
  bodyKey: 'candidate' | 'examiner'
}

/**
 * The exchange in reading order: a claim, then the question it earns.
 */
const EXCERPT_TURNS: ExcerptTurn[] = [
  { role: 'candidate', bodyKey: 'candidate' },
  { role: 'examiner', bodyKey: 'examiner' },
]

/**
 * A sample defense, set in the same voices the real transcript uses: the student in a brand-tinted card,
 * Mathilda bare beneath it.
 *
 * Its bodies are read raw, because a message holding LaTeX carries braces that ICU would otherwise parse
 * as its own argument placeholders.
 */
export function MathildaExcerpt() {
  // Copy for the exchange
  const t = useTranslations('home.mathilda.exchange')

  // Defense-surface copy
  const tDefense = useTranslations('defense')

  // The label each role speaks under
  const roleLabels: Record<TurnRole, string> = {
    examiner: MATHILDA_NAME,
    candidate: tDefense('roles.student'),
  }

  return (
    <SurfacePanel radius="xl">
      {/* The problem being defended */}
      <div className="math-typography math-compact border-b border-foreground/10 p-3.5 text-muted-foreground sm:p-4">
        <MathRendererClient content={t.raw('statement') as string} />
      </div>

      {/* The exchange */}
      <div className="space-y-3 p-3.5 sm:p-4">
        {EXCERPT_TURNS.map((turn) => {
          // The look for this turn's author
          const style = TURN_STYLES[turn.role]

          return (
            <div
              key={turn.bodyKey}
              className={cn('space-y-1', style.container, style.hasOwnBox && 'px-3.5 py-2.5')}
            >
              {/* Who is speaking */}
              <div className={cn(TURN_LABEL_CLASS, style.label)}>{roleLabels[turn.role]}</div>

              {/* What they said */}
              <div className={cn(style.body, 'math-compact')}>
                <MathRendererClient content={t.raw(turn.bodyKey) as string} />
              </div>
            </div>
          )
        })}
      </div>
    </SurfacePanel>
  )
}
