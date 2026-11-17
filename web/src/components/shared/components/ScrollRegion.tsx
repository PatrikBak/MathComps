import { FOCUS_RING_INSET_CLASS } from '@/components/shared/components/Button'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ScrollRegion} component.
 */
type ScrollRegionProps = {
  /** What the region holds, as it is named to the reader. */
  label: string
  /** Classes placing the region and spacing what it holds. */
  className: string
  /** What is read in the region. */
  children: React.ReactNode
}

/**
 * A region that scrolls on its own. It names itself and takes focus, since a region that only scrolls is otherwise out
 * of reach from the keyboard, and rings itself inside its own box, where a scroll container can't clip the ring.
 */
export function ScrollRegion({ label, className, children }: ScrollRegionProps) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={label}
      className={cn(
        'min-h-0 overflow-y-auto overscroll-contain',
        FOCUS_RING_INSET_CLASS,
        className
      )}
    >
      {children}
    </div>
  )
}
