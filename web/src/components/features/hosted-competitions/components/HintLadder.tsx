'use client'

import { useHotkeys } from '@mantine/hooks'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import { Button, FOCUS_RING_CLASS } from '@/components/shared/components/Button'
import { ProblemMarkdown } from '@/components/shared/components/rich-math-editor/components/ProblemMarkdown'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link HintLadder} component.
 */
type HintLadderProps = {
  /** The author's hints in the language being read, weakest nudge first. */
  hints: string[]
}

/**
 * The author's hints, one rung at a time.
 *
 * The hints are ordered weakest nudge first, so the number is the whole of what tells one rung from
 * another. The arrows walk the ladder in order, a number jumps straight to its rung, and ◀/▶ do the same
 * from the keyboard.
 */
export function HintLadder({ hints }: HintLadderProps) {
  // Competitions copy
  const t = useTranslations('competitions')

  // Id prefix unique to this ladder
  const ladderId = useId()

  // Which rung is showing
  const [index, setIndex] = useState(0)

  // Walks the ladder, stopping at either end
  const step = (offset: number) =>
    setIndex((current) => Math.min(Math.max(current + offset, 0), hints.length - 1))

  // Whether there is a rung to step onto in either direction
  const canStepBack = index > 0
  const canStepOn = index < hints.length - 1

  // ◀ and ▶ walk the ladder from the keyboard
  useHotkeys([
    ['ArrowLeft', () => step(-1)],
    ['ArrowRight', () => step(1)],
  ])

  return (
    <div className="-mx-4 -my-3 sm:-mx-5">
      {/* Which rung is showing, and the ways onto another */}
      <div className="flex items-center gap-1 border-b border-foreground/10 px-2 py-1.5 sm:px-3">
        {/* Back a rung */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('previousHint')}
          aria-keyshortcuts="ArrowLeft"
          disabled={!canStepBack}
          onClick={() => step(-1)}
        >
          <ChevronLeft size={16} />
        </Button>

        {/* Every rung, by number */}
        <div role="tablist" aria-label={t('hints')} className="flex items-center gap-1">
          {hints.map((hint, rung) => (
            <button
              key={rung}
              type="button"
              role="tab"
              id={`${ladderId}-${rung}`}
              aria-selected={rung === index}
              onClick={() => setIndex(rung)}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-md text-sm tabular-nums',
                FOCUS_RING_CLASS,
                rung === index
                  ? 'bg-foreground/10 font-semibold text-foreground'
                  : 'text-muted hover:bg-foreground/5 hover:text-foreground'
              )}
            >
              {rung + 1}
            </button>
          ))}
        </div>

        {/* On a rung, the next one along */}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('nextHint')}
          aria-keyshortcuts="ArrowRight"
          disabled={!canStepOn}
          onClick={() => step(1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Every rung laid in the one grid cell, so the surface stands at the height of the longest of
          them and a step leaves the modal exactly where it was. Only the showing rung is lit and reachable */}
      <div className="grid px-4 py-4 sm:px-5">
        {hints.map((hint, rung) => (
          <div
            key={rung}
            role="tabpanel"
            aria-labelledby={`${ladderId}-${rung}`}
            inert={rung !== index}
            className={cn(
              'math-typography math-reference col-start-1 row-start-1',
              'transition-opacity duration-200 motion-reduce:transition-none',
              rung === index ? 'opacity-100' : 'opacity-0'
            )}
          >
            <ProblemMarkdown content={hint} />
          </div>
        ))}
      </div>
    </div>
  )
}
