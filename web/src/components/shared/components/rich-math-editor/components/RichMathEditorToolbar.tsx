import {
  Bold,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquareQuote,
  Paperclip,
  SquareSlash,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ComponentType } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'

import {
  applyBold,
  applyBulletList,
  applyInlineMath,
  applyItalic,
  applyNumberedList,
  applyQuote,
  type EditContext,
  type EditResult,
  insertBlockMath,
  insertHeading,
  insertLatexCommand,
  insertLink,
  insertSpoiler,
  type TransformLabels,
} from '../utils/transforms'
import {
  type RichMathEditorVariant,
  showsToolbarItem,
  type ToolbarConfig,
  type ToolbarItem,
} from './RichMathEditor'
import { RichMathEditorEmojiPicker } from './RichMathEditorEmojiPicker'
import { RichMathEditorLaTeXSymbolPicker } from './RichMathEditorLaTeXSymbolPicker'
import { RichMathEditorOverflowMenu } from './RichMathEditorOverflowMenu'
import { ToolbarButton } from './RichMathEditorToolbarButton'

/**
 * Props for the {@link RichMathEditorToolbar} component.
 */
type RichMathEditorToolbarProps = {
  /** Visual variant of the editor */
  variant: RichMathEditorVariant
  /** Which toolbar entries to show; every entry defaults to on */
  config?: ToolbarConfig
  /** When true, omits border styling (for use in containers that handle their own borders) */
  borderless?: boolean
  /** Function to apply a transform to the textarea content */
  onEdit: (transform: (context: EditContext) => EditResult) => void
  /** Function to insert text directly at the cursor position (used for picker items) */
  onInsert: (text: string) => void
  /** Callback triggered when the image picker button is clicked */
  onImageClick: () => void
  /** Callback triggered when the attachment picker button is clicked */
  onAttachmentClick: () => void
}

/**
 * A toolbar entry in the wide-only group.
 */
type WideToolbarItem = {
  /** The icon shown for the entry. */
  icon: ComponentType<{ size?: number }>
  /** The entry's localized label / tooltip. */
  label: string
  /** Runs the entry's edit. */
  onClick: () => void
}

/**
 * A toolbar for the {@link RichMathEditor} component.
 */
export function RichMathEditorToolbar({
  variant,
  config,
  borderless = false,
  onEdit,
  onInsert,
  onImageClick,
  onAttachmentClick,
}: RichMathEditorToolbarProps) {
  // Translations for editor
  const tEditor = useTranslations('ui.editor')

  // Whether a toolbar entry is shown (every entry defaults to on)
  const shows = (item: ToolbarItem) => showsToolbarItem(config, item)

  // Modifier key symbol (⌘ on Mac, Ctrl elsewhere)
  const { isMac } = useDeviceCapabilities()
  const modifier = isMac ? '⌘' : 'Ctrl'

  // Build localized labels for transforms that insert text into the editor
  const transformLabels: TransformLabels = {
    spoilerLabel: tEditor('hiddenText'),
    spoilerPlaceholder: tEditor('hiddenContentPlaceholder'),
    headingPlaceholder: tEditor('headingPlaceholder'),
  }

  // The wide-only group, each entry present only when shown
  const wideItems: (WideToolbarItem | false)[] = [
    shows('numberedList') && {
      icon: ListOrdered,
      label: tEditor('numberedList'),
      onClick: () => onEdit(applyNumberedList),
    },
    shows('bulletList') && {
      icon: List,
      label: tEditor('bulletList'),
      onClick: () => onEdit(applyBulletList),
    },
    shows('quote') && {
      icon: MessageSquareQuote,
      label: tEditor('quote'),
      onClick: () => onEdit(applyQuote),
    },
    shows('heading') && {
      icon: Heading3,
      label: tEditor('heading'),
      onClick: () => onEdit((context) => insertHeading(context, transformLabels)),
    },
    shows('link') && {
      icon: Link,
      label: tEditor('link', { modifier }),
      onClick: () => onEdit(insertLink),
    },
    shows('spoiler') && {
      icon: SquareSlash,
      label: tEditor('spoiler'),
      onClick: () => onEdit((context) => insertSpoiler(context, transformLabels)),
    },
    shows('attachment') && {
      icon: Paperclip,
      label: tEditor('attachment'),
      onClick: onAttachmentClick,
    },
  ]

  // Just the shown entries
  const overflowItems = wideItems.filter((item): item is WideToolbarItem => item !== false)

  return (
    <div
      className={cn(
        '@container flex items-center gap-0.5 px-1 py-1 flex-wrap sticky top-0 z-10',
        {
          card: cn(
            'bg-surface/50',
            !borderless && 'rounded-t-lg border border-b-0 border-foreground/10'
          ),
          inline: 'pb-1',
        }[variant]
      )}
    >
      {/* Core formatting: Bold, Italic */}
      {shows('bold') && (
        <ToolbarButton
          onClick={() => onEdit(applyBold)}
          icon={Bold}
          title={tEditor('bold', { modifier })}
        />
      )}
      {shows('italic') && (
        <ToolbarButton
          onClick={() => onEdit(applyItalic)}
          icon={Italic}
          title={tEditor('italic', { modifier })}
        />
      )}

      {/* Math: $, $$, and symbol picker */}
      {shows('inlineMath') && (
        <ToolbarButton
          onClick={() => onEdit(applyInlineMath)}
          text="$"
          title={tEditor('inlineMath', { modifier })}
        />
      )}
      {shows('blockMath') && (
        <ToolbarButton
          onClick={() => onEdit(insertBlockMath)}
          text="$$"
          title={tEditor('blockMath')}
        />
      )}
      {shows('symbols') && (
        <RichMathEditorLaTeXSymbolPicker
          onSymbolClick={(command, args) =>
            onEdit((context) => insertLatexCommand(context, command, args))
          }
        />
      )}

      {/* Wide-only group, shown when the container is wide enough */}
      {overflowItems.length > 0 && (
        <div className="hidden items-center gap-0.5 @[480px]:flex">
          {overflowItems.map((item) => (
            <ToolbarButton
              key={item.label}
              onClick={item.onClick}
              icon={item.icon}
              title={item.label}
            />
          ))}
        </div>
      )}

      {/* Image and emoji icons */}
      {shows('image') && (
        <ToolbarButton onClick={onImageClick} icon={Image} title={tEditor('image')} />
      )}
      {shows('emoji') && <RichMathEditorEmojiPicker onEmojiClick={onInsert} />}

      {/* Overflow menu for the wide-only group on narrow containers */}
      {overflowItems.length > 0 && (
        <div className="@[480px]:hidden">
          <RichMathEditorOverflowMenu items={overflowItems} />
        </div>
      )}
    </div>
  )
}
