/**
 * Props for the {@link LabelledSection} component.
 */
type LabelledSectionProps = {
  /** What the section is called. */
  label: string
  /** The section itself. */
  children: React.ReactNode
}

/**
 * A section under a small label, set quieter than any heading in the section itself.
 */
export function LabelledSection({ label, children }: LabelledSectionProps) {
  return (
    <section>
      {/* Section label */}
      <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">{label}</h3>

      {children}
    </section>
  )
}
