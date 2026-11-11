import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Props for the {@link DefensePhotoTrouble}.
 */
type DefensePhotoTroubleProps = {
  /** What went wrong, by name, for a note standing apart from it, or null for a note standing in its place. */
  heading: string | null
  /** Why it went wrong, in words. */
  why: string
  /** The way past it. */
  children: ReactNode
}

/**
 * Something that went wrong with the photos, said where it happened: the warning mark, why, and the way past it. It
 * brings no box of its own, so each surface lays its pieces out where they stand.
 */
export function DefensePhotoTrouble({ heading, why, children }: DefensePhotoTroubleProps) {
  // The mark, why, and the way past it
  return (
    <>
      {/* The mark a failed photo's tile carries too */}
      <TriangleAlert className="size-5 text-error" aria-hidden="true" />

      {/* What went wrong, when the note stands apart from it, and why, heard as it comes, in the foreground since the
          error red is too faint for small text */}
      <div role="alert" className="min-w-0 text-foreground">
        {heading !== null && <p className="font-medium">{heading}</p>}
        <p className="text-balance">{why}</p>
      </div>

      {/* The way past it */}
      {children}
    </>
  )
}
