'use client'

import type { LucideIcon } from 'lucide-react'
import type { RefObject } from 'react'

import { Button } from '@/components/shared/components/Button'
import { useFocusHandOff } from '@/hooks/use-focus-hand-off'

/**
 * Props for the {@link WaitingChangeButton} component.
 */
type WaitingChangeButtonProps = {
  /** What the button does to the list, which a screen reader also hears as the change arrives. */
  label: string
  /** The icon beside the label. */
  icon: LucideIcon
  /** Whether a change waits to be shown. */
  isWaiting: boolean
  /** Shows the change. */
  onShow: () => void
  /** What takes the focus when the button leaves holding it with no item of the list to take it. */
  fallbackRef: RefObject<HTMLElement | null>
}

/**
 * The button showing a change a list holds back, so nothing moves under the reader until they ask, and the line
 * telling a screen reader that one waits. The button rests just below the header over the list as the list scrolls,
 * taking no room in it, so nothing moves as it appears. Leaving while it holds the focus, the change gone again
 * without being asked for, it hands the focus to the list's first item as {@link useFocusHandOff} does.
 */
export function WaitingChangeButton({
  label,
  icon: Icon,
  isWaiting,
  onShow,
  fallbackRef,
}: WaitingChangeButtonProps) {
  return (
    <>
      {/* That a change waits, said to a screen reader as it arrives */}
      <p role="status" className="sr-only">
        {isWaiting ? label : ''}
      </p>

      {/* The button itself, while a change waits */}
      {isWaiting && (
        <StickyButton label={label} icon={Icon} onShow={onShow} fallbackRef={fallbackRef} />
      )}
    </>
  )
}

/**
 * Props for the {@link StickyButton} component.
 */
type StickyButtonProps = Omit<WaitingChangeButtonProps, 'isWaiting'>

/**
 * The button of a {@link WaitingChangeButton}, held just below the header over the list.
 */
function StickyButton({ label, icon: Icon, onShow, fallbackRef }: StickyButtonProps) {
  // The focus handed on as the button leaves holding it
  const handOff = useFocusHandOff<HTMLDivElement>(fallbackRef)

  return (
    // Centred on the list's top edge, clear of the first item, and 8px below the header once held there: 26px is
    // those 8px and half the small pill's 36px
    <div
      {...handOff}
      className="sticky-below-header top-[calc(var(--header-height)+26px)] pointer-events-none h-0"
    >
      <div className="flex -translate-y-1/2 justify-center">
        <Button
          size="sm"
          variant="outline"
          shape="pill"
          onClick={onShow}
          // Solid over the items passing under it
          className="pointer-events-auto border-brand/40 bg-background/95 shadow-lg backdrop-blur"
        >
          <Icon size={14} />
          {label}
        </Button>
      </div>
    </div>
  )
}
