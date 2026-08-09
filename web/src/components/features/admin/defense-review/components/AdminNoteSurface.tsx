import { cn } from '@/components/shared/utils/css-utils'

/** How much room a note is given around it. */
type AdminNotePadding = 'tight' | 'roomy'

/** The room each amount leaves. */
const PADDING_CLASSES: Record<AdminNotePadding, string> = {
  tight: 'px-3 py-2.5',
  roomy: 'px-4 py-3',
}

/**
 * Props for the {@link AdminNoteSurface} component.
 */
type AdminNoteSurfaceProps = {
  /** The note it stands for. */
  noteId: string
  /** Whether the note has been settled, which fades it back. */
  isResolved: boolean
  /** Whether something outside the list points at this note. */
  isPointedAt: boolean
  /** How much room to leave around it. */
  padding: AdminNotePadding
  /** The note as it reads. */
  children: React.ReactNode
}

/**
 * The card a note is written on.
 *
 * Neutral rather than tinted: violet belongs to the examiner and the student's own turns already sit on a tint
 * of it, so a coloured fill here would read as part of the exchange rather than as something written about it.
 *
 * The room differs by what else the card carries, which is the only thing that does: a note read out of its
 * conversation is headed by the conversation it came from, and that heading needs the space.
 *
 * It carries the id of the note it stands for, so that whatever points at one can find the card on screen.
 */
export function AdminNoteSurface({
  noteId,
  isResolved,
  isPointedAt,
  padding,
  children,
}: AdminNoteSurfaceProps) {
  return (
    <article
      data-note-id={noteId}
      className={cn(
        'rounded-xl border border-foreground/10 bg-foreground/[0.03]',
        PADDING_CLASSES[padding],
        isResolved && 'opacity-60',
        // A ring, the same mark the conversation carries for the reply a note is being written against
        isPointedAt && 'ring-2 ring-inset ring-focus/60'
      )}
    >
      {children}
    </article>
  )
}
