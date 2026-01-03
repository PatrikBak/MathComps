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
  return (
    <div
      className={cn(
        '@container flex items-center gap-0.5 px-1 py-1 flex-wrap sticky top-0 z-10',
        {
          card: cn(
            'bg-slate-800/50',
            !borderless && 'rounded-t-lg border border-b-0 border-slate-600/60'
          ),
          inline: 'pb-1',
        }[variant]
      )}
    >
      {/* Core formatting: Bold, Italic */}
      <ToolbarButton onClick={() => onEdit(applyBold)} icon={Bold} title="Tučné (Ctrl+B)" />
      <ToolbarButton onClick={() => onEdit(applyItalic)} icon={Italic} title="Kurzíva (Ctrl+I)" />

      {/* Math: $, $$, and symbol picker */}
      <ToolbarButton
        onClick={() => onEdit(applyInlineMath)}
        text="$"
        title="Inline matematika ($)"
      />
      <ToolbarButton
        onClick={() => onEdit(insertBlockMath)}
        text="$$"
        title="Bloková matematika ($$)"
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
          title="Číslovaný zoznam"
        />
        <ToolbarButton
          onClick={() => onEdit(applyBulletList)}
          icon={List}
          title="Odrážkový zoznam"
        />
        <ToolbarButton
          onClick={() => onEdit(applyQuote)}
          icon={MessageSquareQuote}
          title="Citácia"
        />
        <ToolbarButton onClick={() => onEdit(insertHeading)} icon={Heading3} title="Nadpis" />
        <ToolbarButton onClick={() => onEdit(insertLink)} icon={Link} title="Odkaz" />
        <ToolbarButton
          onClick={() => onEdit(insertSpoiler)}
          icon={SquareSlash}
          title="Skrytý text (||[Názov]obsah||)"
        />
        <ToolbarButton
          onClick={onAttachmentClick}
          icon={Paperclip}
          title="Príloha (PDF, TXT, MD)"
        />
      </div>

      {/* Image and emoji icons */}
      <ToolbarButton
        onClick={onImageClick}
        icon={Image}
        title="Obrázok (vložiť diagram/graf, nie snímky textu)"
      />
      <RichMathEditorEmojiPicker onEmojiClick={onInsert} />

      {/* Overflow menu for narrow containers */}
      <div className="@[480px]:hidden">
        <RichMathEditorOverflowMenu
          items={[
            {
              icon: ListOrdered,
              label: 'Číslovaný zoznam',
              title: 'Číslovaný zoznam',
              onClick: () => onEdit(applyNumberedList),
            },
            {
              icon: List,
              label: 'Odrážkový zoznam',
              title: 'Odrážkový zoznam',
              onClick: () => onEdit(applyBulletList),
            },
            {
              icon: MessageSquareQuote,
              label: 'Citácia',
              title: 'Citácia',
              onClick: () => onEdit(applyQuote),
            },
            {
              icon: Heading3,
              label: 'Nadpis',
              title: 'Nadpis',
              onClick: () => onEdit(insertHeading),
            },
            {
              icon: Link,
              label: 'Odkaz',
              title: 'Odkaz',
              onClick: () => onEdit(insertLink),
            },
            {
              icon: SquareSlash,
              label: 'Skrytý text',
              title: 'Skrytý text (||[Názov]obsah||)',
              onClick: () => onEdit(insertSpoiler),
            },
            {
              icon: Paperclip,
              label: 'Príloha',
              title: 'Príloha (PDF, TXT, MD)',
              onClick: onAttachmentClick,
            },
          ]}
        />
      </div>
    </div>
  )
}
