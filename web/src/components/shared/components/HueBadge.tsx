import { cn } from '@/components/shared/utils/css-utils'
import { hueColor, hueTextStyle, hueTint } from '@/components/shared/utils/hue-colors'

/** How large a badge is drawn. */
type HueBadgeSize = 'regular' | 'small'

/** The padding and text size of each badge size. */
const SIZE_CLASS: Record<HueBadgeSize, string> = {
  regular: 'px-2 py-0.5 text-sm',
  small: 'px-1.5 py-0.5 text-xs',
}

/**
 * Props for the {@link HueBadge} component.
 */
type HueBadgeProps = {
  /** What the badge says. */
  label: string
  /** The hue it wears, by its index from zero; null for none. */
  hue: number | null
  /** How large the badge is drawn. */
  size?: HueBadgeSize
}

/**
 * A label in its hue's colour, on a faint wash of the same hue. A badge with no hue is in the page's own text colour,
 * on a faint wash of it.
 */
export function HueBadge({ label, hue, size = 'regular' }: HueBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-md font-semibold',
        SIZE_CLASS[size],
        hue === null && 'bg-foreground/[0.06]'
      )}
      style={
        hue === null ? hueTextStyle(null) : { color: hueColor(hue), backgroundColor: hueTint(hue) }
      }
    >
      {label}
    </span>
  )
}
