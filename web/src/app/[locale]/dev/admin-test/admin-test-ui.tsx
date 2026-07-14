import type { ReactNode } from 'react'

/**
 * Props for {@link Section}.
 */
type SectionProps = {
  /** The section heading. */
  title: string
  /** The section body. */
  children: ReactNode
}

/**
 * A bordered card with a heading above its body.
 */
export function Section({ title, children }: SectionProps) {
  return (
    <section className="rounded-md border border-foreground/15 bg-foreground/5 p-4">
      {/* Section heading */}
      <h2 className="mb-2 font-medium">{title}</h2>
      {children}
    </section>
  )
}

/**
 * Props for {@link Field}.
 */
type FieldProps = {
  /** The field label. */
  label: string
  /** The field value, rendered emphasized. */
  value: ReactNode
}

/**
 * A `label: value` readout row.
 */
export function Field({ label, value }: FieldProps) {
  return (
    <p className="text-sm text-muted">
      {label}: <span className="text-foreground">{value}</span>
    </p>
  )
}
