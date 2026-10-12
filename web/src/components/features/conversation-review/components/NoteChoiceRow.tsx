/**
 * Props for the {@link NoteChoiceRow} component.
 */
type NoteChoiceRowProps = {
  /** What the row is choosing. */
  label: string
  /** The chips to choose from. */
  children: React.ReactNode
}

/**
 * One row of a note's choices: what is being chosen, and the chips it is chosen from.
 *
 * The label holds a column of its own beside the chips rather than sitting above them. Two unlabelled rows of
 * chips read as one heap the moment they wrap, and stacking a heading over each would spend two lines saying
 * what a word at the left says once. It is written twice because a legend is read out but never laid out
 * inside a flex row.
 */
export function NoteChoiceRow({ label, children }: NoteChoiceRowProps) {
  return (
    <fieldset className="flex items-start gap-3">
      {/* The name assistive tech reads */}
      <legend className="sr-only">{label}</legend>

      {/* The same name on screen */}
      <span aria-hidden="true" className="w-14 shrink-0 pt-1.5 text-xs text-muted">
        {label}
      </span>

      {/* The chips themselves */}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </fieldset>
  )
}
