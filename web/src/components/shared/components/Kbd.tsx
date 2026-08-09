/**
 * Props for the {@link Kbd} component.
 */
type KbdProps = {
  /** The key as it is printed on the keyboard. */
  children: React.ReactNode
}

/**
 * One key of a keyboard shortcut, drawn as the key itself.
 */
export function Kbd({ children }: KbdProps) {
  return (
    <kbd className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-xs text-muted-foreground">
      {children}
    </kbd>
  )
}
