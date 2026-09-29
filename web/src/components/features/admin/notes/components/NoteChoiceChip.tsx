import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link NoteChoiceChip} component.
 */
type NoteChoiceChipProps = {
  /** The radio group it belongs to, which has to be unique per mounted group. */
  groupName: string
  /** What it says. */
  label: string
  /** What it announces, for a chip whose visible label is a shorthand; the label itself otherwise. */
  accessibleLabel?: string
  /** Whether it is the one picked. */
  isSelected: boolean
  /** Picks it. */
  onSelect: () => void
}

/**
 * The look of one choice chip, whatever kind of input is hiding inside it.
 *
 * The input a chip is built around is invisible, so the focus ring has to be drawn on the label around it,
 * which is what `has-[:focus-visible]` is doing.
 *
 * @param isSelected - Whether it is the one picked.
 *
 * @returns The classes it is drawn with.
 */
export function noteChoiceChipClass(isSelected: boolean): string {
  // The shape every chip has, and what being the picked one does to it
  return cn(
    'cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors',
    'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus',
    'has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
    isSelected
      ? 'border-brand/60 bg-brand/20 font-medium text-foreground'
      : 'border-foreground/15 text-muted hover:border-foreground/30 hover:text-foreground'
  )
}

/**
 * One choice in a row of chips, backed by a real radio input rather than a button.
 *
 * The input is a genuine radio so the row is one arrow-key group to a keyboard and announces itself as a
 * choice to a screen reader; the visible chip is the label around it.
 */
export function NoteChoiceChip({
  groupName,
  label,
  accessibleLabel,
  isSelected,
  onSelect,
}: NoteChoiceChipProps) {
  return (
    <label className={noteChoiceChipClass(isSelected)}>
      <input
        type="radio"
        name={groupName}
        className="sr-only"
        checked={isSelected}
        onChange={onSelect}
        aria-label={accessibleLabel}
      />
      {label}
    </label>
  )
}
