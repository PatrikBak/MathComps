import { cn } from '@/components/shared/utils/css-utils'

import { HANDOUT_DIFFICULTY_LEVELS, type HandoutDifficulty } from './handout-metadata-types'

/** The height of each bar, ascending with the level */
const BAR_HEIGHT: Record<HandoutDifficulty, string> = {
  1: 'h-1.5',
  2: 'h-2.5',
  3: 'h-3.5',
}

/**
 * Props for the {@link DifficultyMeter} component.
 */
type DifficultyMeterProps = {
  /** The difficulty level to display. */
  level: HandoutDifficulty
  /** Screen-reader text naming the level. */
  srLabel?: string
}

/**
 * A handout's difficulty as three ascending-height bars, filled up to the current level. Filled bars
 * warm to the accent while the enclosing group is hovered.
 */
export function DifficultyMeter({ level, srLabel }: DifficultyMeterProps) {
  // The bar row
  return (
    <span className="flex shrink-0 items-end gap-0.5">
      {/* Screen-reader level */}
      {srLabel && <span className="sr-only">{srLabel}</span>}

      {/* One bar per level, filled up to the current level */}
      {HANDOUT_DIFFICULTY_LEVELS.map((bar) => (
        <span
          key={bar}
          aria-hidden
          className={cn(
            'w-1 rounded-[1px] transition-colors motion-reduce:transition-none',
            BAR_HEIGHT[bar],
            bar <= level ? 'bg-foreground/60 group-hover:bg-brand-light' : 'bg-foreground/15'
          )}
        />
      ))}
    </span>
  )
}
