/**
 * Props for the {@link ActionLabel} component.
 */
type ActionLabelProps = {
  /** What the control does. */
  children: React.ReactNode
}

/**
 * The words beside an icon on a control: always read out, on screen from `lg` up.
 *
 * The review surface's headers hold their controls in a row that also carries a name to truncate and a place
 * in the queue to count, and the Czech and Slovak wordings of these are long enough to leave nothing for the
 * name. A narrow layout therefore keeps the control and drops its words to the accessibility tree, which
 * carries them at every width.
 */
export function ActionLabel({ children }: ActionLabelProps) {
  return <span className="sr-only lg:not-sr-only">{children}</span>
}
