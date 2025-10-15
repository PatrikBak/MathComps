import { Loader2 } from 'lucide-react'

/**
 * A route-level loading component designed for a minimalistic and clean user experience.
 *
 * This component centers a subtle spinning loader within the full viewport.
 * It avoids complex layouts or heavy styling to prevent layout shifts and
 * provide an unobtrusive indication that content is being loaded.
 *
 * The "sr-only" class on the text ensures accessibility for screen readers
 * while keeping the visual interface as clean as possible.
 */
export default function Loading() {
  return (
    <div
      className="flex min-h-screen w-full items-center justify-center bg-background"
      // Accessibility attributes to inform assistive technologies that the page is busy loading.
      aria-live="polite"
      aria-busy="true"
    >
      <Loader2 className="h-15 w-15 animate-spin text-muted-foreground" />
      <span className="sr-only">Načítavam...</span>
    </div>
  )
}
