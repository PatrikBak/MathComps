import type { ReactNode } from 'react'

/**
 * Props for the {@link BeatLabel} component.
 */
type BeatLabelProps = {
  /** The label text naming this beat of the story */
  children: ReactNode
}

/**
 * The marker that heads each beat of the about narrative: a short brand rule above a small label.
 */
export default function BeatLabel({ children }: BeatLabelProps) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="h-px w-8 bg-brand/50" />
      <span className="text-sm font-semibold text-brand-light hyphens-none">{children}</span>
    </div>
  )
}
