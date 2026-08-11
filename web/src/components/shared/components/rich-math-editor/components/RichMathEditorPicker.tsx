import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { preventFocusLoss } from '../utils/keyboard-utils'

/**
 * Props for the {@link RichMathEditorPicker} component.
 */
type RichMathEditorPickerProps = {
  /** Content to display inside the trigger button */
  triggerContent: ReactNode
  /** Title/tooltip for the trigger button */
  triggerTitle: string
  /** Render prop children that receive close function for closing after selection */
  children: (props: { close: () => void }) => ReactNode
  /** Additional className for the popup container */
  popupClassName?: string
}

/**
 * A reusable picker wrapper using Headless UI Popover.
 */
export function RichMathEditorPicker({
  triggerContent,
  triggerTitle,
  children,
  popupClassName,
}: RichMathEditorPickerProps) {
  return (
    <Popover>
      {({ open, close }) => (
        <>
          <PopoverButton
            title={triggerTitle}
            onMouseDown={preventFocusLoss}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-xs',
              open
                ? 'text-brand-light bg-brand/10'
                : 'text-muted hover:text-foreground hover:bg-foreground/10'
            )}
          >
            {triggerContent}
          </PopoverButton>

          <PopoverPanel
            anchor="bottom start"
            transition
            className={cn(
              'z-floating mt-1 shadow-2xl border border-foreground/10 rounded-xl overflow-hidden',
              'origin-top-left transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
              popupClassName
            )}
          >
            {children({ close })}
          </PopoverPanel>
        </>
      )}
    </Popover>
  )
}
