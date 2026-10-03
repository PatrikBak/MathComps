import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import type { ReactNode } from 'react'

import {
  FLOATING_PANEL_CLASS,
  FLOATING_PANEL_FILLS,
} from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'

import { ToolbarButton, type ToolbarButtonProps } from './RichMathEditorToolbarButton'

/**
 * Props for the {@link RichMathEditorPicker} component.
 */
type RichMathEditorPickerProps = Required<Pick<ToolbarButtonProps, 'mark' | 'title' | 'isRow'>> & {
  /**
   * Renders what there is to pick from, given the function that closes the picker. Closing hands the
   * cursor to the picker's button, so a pick closes it before handing anything over
   */
  children: (close: () => void) => ReactNode
  /** Classes for the panel the picker opens */
  popupClassName: string
}

/**
 * A tool of the editor's toolbar that opens a panel to pick from: its button, a square on the toolbar's
 * row or a row of the overflow's list, and the panel it opens.
 */
export function RichMathEditorPicker({
  mark,
  title,
  isRow,
  children,
  popupClassName,
}: RichMathEditorPickerProps) {
  // The button, and the panel it opens
  return (
    <Popover>
      {/* The button that opens the picker */}
      <PopoverButton as={ToolbarButton} mark={mark} title={title} isRow={isRow} />

      {/* What there is to pick from */}
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 4, padding: 8 }}
        transition
        className={cn(
          FLOATING_PANEL_CLASS,
          FLOATING_PANEL_FILLS.page,
          'origin-top-left transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0',
          popupClassName
        )}
      >
        {({ close }) => <>{children(() => close())}</>}
      </PopoverPanel>
    </Popover>
  )
}
