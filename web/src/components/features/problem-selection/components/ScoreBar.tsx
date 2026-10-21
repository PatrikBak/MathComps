'use client'

import { ChevronLeft, ChevronRight, type LucideIcon, X } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useId } from 'react'

import { Button } from '@/components/shared/components/Button'
import { DropdownMenuItem } from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

import { type ScoreBarLook, useScoreBar } from '../hooks/use-score-bar'
import { BAR_STEP, MAX_SCORE, MIN_SCORE, stepScore, WHOLE_SCORES } from '../model/rating-scale'
import type { RatingAspect } from '../model/selection-types'
import { NoScore, SCORE_FORMAT } from './RatingBreakdown'

/** The fill under each way the bar draws its score: the score itself, under a press, or as a hover's preview. */
const FILL_LOOK_CLASS: Record<ScoreBarLook, string> = {
  standing: 'bg-brand/40 transition-[width] duration-120 ease-out motion-reduce:transition-none',
  pressed: 'bg-brand/40',
  hovered: 'bg-brand/25 transition-[width] duration-120 ease-out motion-reduce:transition-none',
}

/**
 * Props for the {@link ScoreBar} component.
 */
type ScoreBarProps = {
  /** The aspect scored. */
  aspect: RatingAspect
  /** The reader's score for the aspect; null for none. */
  score: number | null
  /** Sets the reader's score for the aspect; null takes it back. */
  onScore: (score: number | null) => void
  /**
   * Sets the reader's score for the aspect from a key, which may come again at once while the key is held; null
   * takes it back.
   */
  onKeyScore: (score: number | null) => void
}

/**
 * The reader's score for one aspect in a problem's menu: the aspect's name and score over a bar holding the whole
 * scores, filled from the left up to the score. Pressing the bar gives the half step pressed and keeps the menu open,
 * and a drag sets the step it lets go on. The arrows beside the score move it a tenth and the cross takes it back,
 * as the arrow keys and Backspace do on the bar. Up and down stay the menu's.
 */
export function ScoreBar({ aspect, score, onScore, onKeyScore }: ScoreBarProps) {
  // Rating copy
  const t = useTranslations('problemSelection.ratings')

  // Numbers in the reader's language
  const format = useFormatter()

  // The id of the aspect's name
  const labelId = useId()

  // The score shown, how to draw it, the way to set it, and the bar's handlers
  const bar = useScoreBar({ score, onScore, onKeyScore })

  // The aspect's name
  const name = t(aspect)

  return (
    <>
      {/* The aspect, its score, and the buttons moving the score a tenth or taking it back */}
      <div className="flex items-center gap-0.5 pt-1 pr-1 pl-2">
        <p id={labelId} className="mr-auto text-xs font-semibold text-muted">
          {name}
        </p>
        <ScoreButton
          icon={ChevronLeft}
          label={t('lowerScore', { aspect: name })}
          disabled={score === null || score === MIN_SCORE}
          onPress={() => bar.setScore(stepScore(score, -1))}
        />
        <span
          aria-hidden
          className="min-w-7 text-center text-xs font-semibold text-muted tabular-nums"
        >
          {bar.shownScore === null ? <NoScore /> : format.number(bar.shownScore, SCORE_FORMAT)}
        </span>
        <ScoreButton
          icon={ChevronRight}
          label={t('raiseScore', { aspect: name })}
          disabled={score === MAX_SCORE}
          onPress={() => bar.setScore(stepScore(score, 1))}
        />
        <ScoreButton
          icon={X}
          label={t('clearScore', { aspect: name })}
          disabled={score === null}
          onPress={() => bar.setScore(null)}
          className="disabled:invisible"
        />
      </div>

      {/* The bar */}
      <div className="px-2 pb-1.5">
        <DropdownMenuItem
          role="slider"
          aria-labelledby={labelId}
          aria-valuemin={MIN_SCORE}
          aria-valuemax={MAX_SCORE}
          // A slider always holds a value, so no score sits at the bottom, its text saying there is none
          aria-valuenow={score ?? MIN_SCORE}
          aria-valuetext={score === null ? t('noScore') : format.number(score, SCORE_FORMAT)}
          textValue={name}
          className="group h-8 w-44 overflow-hidden rounded-md bg-foreground/5 p-0 touch-none focus:bg-foreground/15 [-webkit-tap-highlight-color:transparent]"
          onSelect={(event) => {
            // The menu stays open
            event.preventDefault()
          }}
          {...bar.handlers}
        >
          {/* The fill, up to the score shown */}
          <span
            className={cn('absolute inset-y-0 left-0', FILL_LOOK_CLASS[bar.look])}
            style={{ width: `${((bar.shownScore ?? 0) / MAX_SCORE) * 100}%` }}
          />

          {/* The whole scores, each lit once the fill reaches the bar's step below it */}
          <span aria-hidden className="absolute inset-0 flex">
            {WHOLE_SCORES.map((whole) => (
              <span
                key={whole}
                className={cn(
                  'flex flex-1 items-center justify-center border-l border-foreground/10 text-xs font-semibold tabular-nums first:border-l-0',
                  bar.shownScore !== null && bar.shownScore >= whole - BAR_STEP
                    ? 'text-brand-foreground'
                    : 'text-muted group-focus:text-foreground'
                )}
              >
                {whole}
              </span>
            ))}
          </span>
        </DropdownMenuItem>
      </div>
    </>
  )
}

/**
 * Props for the {@link ScoreButton} component.
 */
type ScoreButtonProps = {
  /** The icon drawn. */
  icon: LucideIcon
  /** What a press does, read out in the icon's place. */
  label: string
  /** Whether a press would leave the score as it stands. */
  disabled: boolean
  /** Moves the score, or takes it back. */
  onPress: () => void
  /** Classes on top of the button's own. */
  className?: string
}

/**
 * A small button beside a score that moves it or takes it back. A press leaves the focus where it was, so the menu's
 * keys go on working, and the keyboard reaches the same moves through the bar's own keys.
 */
function ScoreButton({ icon: Icon, label, disabled, onPress, className }: ScoreButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      className={cn('size-6 rounded', className)}
      onMouseDown={preventFocusLoss}
      onClick={onPress}
    >
      <Icon aria-hidden className="size-3.5" />
    </Button>
  )
}
