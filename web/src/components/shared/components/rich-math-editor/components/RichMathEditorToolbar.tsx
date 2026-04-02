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

import { cn } from '@/components/shared/utils/css-utils'

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
import type { RichMathEditorVariant } from './RichMathEditor'
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
 * A toolbar for the {@link RichMathEditor} component.
 */
export function RichMathEditorToolbar({
  variant,
  borderless = false,
  onEdit,
  onInsert,
  onImageClick,
  onAttachmentClick,
}: RichMathEditorToolbarProps) {
  // Translations for editor
  const tEditor = useTranslations('ui.editor')

  // Build localized labels for transforms that insert text into the editor
  const transformLabels: TransformLabels = {
    spoilerLabel: tEditor('hiddenText'),
    spoilerPlaceholder: tEditor('hiddenContentPlaceholder'),
    headingPlaceholder: tEditor('headingPlaceholder'),
  }

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
      <ToolbarButton onClick={() => onEdit(applyBold)} icon={Bold} title={tEditor('bold')} />
      <ToolbarButton onClick={() => onEdit(applyItalic)} icon={Italic} title={tEditor('italic')} />

      {/* Math: $, $$, and symbol picker */}
      <ToolbarButton
        onClick={() => onEdit(applyInlineMath)}
        text="$"
        title={tEditor('inlineMath')}
      />
      <ToolbarButton
        onClick={() => onEdit(insertBlockMath)}
        text="$$"
        title={tEditor('blockMath')}
      />
      <RichMathEditorLaTeXSymbolPicker
        onSymbolClick={(command, args) =>
          onEdit((context) => insertLatexCommand(context, command, args))
        }
      />

      {/* Icons shown when container is wide enough */}
      <div className="hidden @[480px]:flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => onEdit(applyNumberedList)}
          icon={ListOrdered}
          title={tEditor('numberedList')}
        />
        <ToolbarButton
          onClick={() => onEdit(applyBulletList)}
          icon={List}
          title={tEditor('bulletList')}
        />
        <ToolbarButton
          onClick={() => onEdit(applyQuote)}
          icon={MessageSquareQuote}
          title={tEditor('quote')}
        />
        <ToolbarButton
          onClick={() => onEdit((context) => insertHeading(context, transformLabels))}
          icon={Heading3}
          title={tEditor('heading')}
        />
        <ToolbarButton onClick={() => onEdit(insertLink)} icon={Link} title={tEditor('link')} />
        <ToolbarButton
          onClick={() => onEdit((context) => insertSpoiler(context, transformLabels))}
          icon={SquareSlash}
          title={tEditor('spoiler')}
        />
        <ToolbarButton onClick={onAttachmentClick} icon={Paperclip} title={tEditor('attachment')} />
      </div>

      {/* Image and emoji icons */}
      <ToolbarButton onClick={onImageClick} icon={Image} title={tEditor('image')} />
      <RichMathEditorEmojiPicker onEmojiClick={onInsert} />

      {/* Overflow menu for narrow containers */}
      <div className="@[480px]:hidden">
        <RichMathEditorOverflowMenu
          items={[
            {
              icon: ListOrdered,
              label: tEditor('numberedList'),
              onClick: () => onEdit(applyNumberedList),
            },
            {
              icon: List,
              label: tEditor('bulletList'),
              onClick: () => onEdit(applyBulletList),
            },
            {
              icon: MessageSquareQuote,
              label: tEditor('quote'),
              onClick: () => onEdit(applyQuote),
            },
            {
              icon: Heading3,
              label: tEditor('heading'),
              onClick: () => onEdit((context) => insertHeading(context, transformLabels)),
            },
            {
              icon: Link,
              label: tEditor('link'),
              onClick: () => onEdit(insertLink),
            },
            {
              icon: SquareSlash,
              label: tEditor('spoiler'),
              onClick: () => onEdit((context) => insertSpoiler(context, transformLabels)),
            },
            {
              icon: Paperclip,
              label: tEditor('attachment'),
              onClick: onAttachmentClick,
            },
          ]}
        />
      </div>
    </div>
  )
}
