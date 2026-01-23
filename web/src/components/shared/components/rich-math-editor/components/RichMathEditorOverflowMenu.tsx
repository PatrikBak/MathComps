import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'

import { preventFocusLoss } from '../utils/keyboard-utils'

/**
 * Item in the {@link RichMathEditorOverflowMenu}.
 */
type RichMathEditorOverflowMenuItem = {
  /** Icon to display next to the label. */
  icon?: React.ComponentType<{ size?: number }>
  /** Text to display next to the icon. */
  text?: string
  /** Label to display in the menu. */
  label: string
  /** Callback when the menu item is clicked. */
  onClick: () => void
}

/**
 * Props for the {@link RichMathEditorOverflowMenu} component.
 */
type RichMathEditorOverflowMenuProps = {
  /** Items to display in the menu. */
  items: RichMathEditorOverflowMenuItem[]
}

/**
 * Overflow menu for mobile toolbar. Uses Headless UI Menu.
 */
export function RichMathEditorOverflowMenu({ items }: RichMathEditorOverflowMenuProps) {
  // Get translations
  const tEditor = useTranslations('ui.editor')

  return (
    <Menu>
      {({ open }) => (
        <>
          <MenuButton
            title={tEditor('moreOptions')}
            onMouseDown={preventFocusLoss}
            className={cn(
              'flex items-center justify-center gap-1.5 px-2 py-1 rounded transition-colors text-xs min-w-[28px]',
              open
                ? 'text-indigo-400 bg-indigo-500/20'
                : 'text-gray-400 hover:text-gray-200 hover:bg-slate-600/50'
            )}
          >
            <Plus size={14} />
          </MenuButton>

          <MenuItems
            anchor="bottom end"
            transition
            className="z-[9999] mt-1 shadow-2xl border border-slate-600/60 rounded-xl overflow-hidden bg-slate-800 min-w-[180px] p-1 origin-top-right transition duration-100 ease-out data-[closed]:scale-95 data-[closed]:opacity-0"
          >
            {items.map((item, index) => (
              <MenuItem key={index}>
                {({ focus }) => (
                  <button
                    type="button"
                    onMouseDown={preventFocusLoss}
                    onClick={item.onClick}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 rounded transition-colors',
                      focus && 'bg-slate-700/60'
                    )}
                  >
                    {item.icon && <item.icon size={16} />}
                    {item.text && (
                      <span className="font-mono font-semibold text-base w-5 text-center">
                        {item.text}
                      </span>
                    )}
                    <span>{item.label}</span>
                  </button>
                )}
              </MenuItem>
            ))}
          </MenuItems>
        </>
      )}
    </Menu>
  )
}
