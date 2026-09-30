import {
  Bold,
  Expand,
  Eye,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListOrdered,
  MessageSquareQuote,
  Paperclip,
  Plus,
  SquareSlash,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment, type ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useDeviceCapabilities } from '@/hooks/use-device-capabilities'
import { useRowOverflow } from '@/hooks/use-row-overflow'

import { type UseEditorPreviewResult } from '../hooks/use-editor-preview'
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
import { showsToolbarItem, type ToolbarConfig, type ToolbarItem } from './RichMathEditor'
import { RichMathEditorEmojiPicker } from './RichMathEditorEmojiPicker'
import { RichMathEditorLaTeXSymbolPicker } from './RichMathEditorLaTeXSymbolPicker'
import { RichMathEditorPicker } from './RichMathEditorPicker'
import { ToolbarButton } from './RichMathEditorToolbarButton'

/**
 * Props for the {@link RichMathEditorToolbar} component.
 */
type RichMathEditorToolbarProps = {
  /** Which toolbar entries to show */
  config: ToolbarConfig | undefined
  /** The text's in-place preview, or null where the editor offers none */
  preview: UseEditorPreviewResult | null
  /** Opens the expanded editor, or null where there is none to open */
  onExpand: (() => void) | null
  /** Applies a transform to the text where the selection stands */
  onEdit: (transform: (context: EditContext) => EditResult) => void
  /** Writes text at the cursor, over any selection */
  onInsert: (text: string) => void
  /** Opens the picker for an image to upload */
  onImageClick: () => void
  /** Opens the picker for an attachment to upload */
  onAttachmentClick: () => void
}

/**
 * A tool of the toolbar.
 */
type ToolbarTool = {
  /** The toolbar entry the tool stands for. */
  item: ToolbarItem
  /**
   * Renders the tool. On the toolbar's row it takes null and is a square around its mark. Listed in the
   * overflow it takes the function that closes the list, which it calls as it is used, and is a row
   * reading its name.
   */
  render: (closeOverflow: (() => void) | null) => ReactNode
}

/**
 * Builds a tool that is pressed for one effect.
 *
 * @param item - The toolbar entry the tool stands for.
 * @param mark - The icon the tool reads as, or the glyph it is written with.
 * @param title - What the tool does.
 * @param onUse - Runs the tool.
 *
 * @returns The tool.
 */
function pressTool(
  item: ToolbarItem,
  mark: ReactNode,
  title: string,
  onUse: () => void
): ToolbarTool {
  // A button on the row, or a row of the overflow's list
  return {
    item,
    render: (closeOverflow) => (
      <ToolbarButton
        mark={mark}
        title={title}
        isRow={closeOverflow !== null}
        onClick={() => {
          // The list it was picked from, if any, goes first, since closing it moves the cursor to its
          // control
          closeOverflow?.()

          // And the tool runs, one that edits the text taking the cursor back into it
          onUse()
        }}
      />
    ),
  }
}

/**
 * A toolbar for the rich math editor: its tools on one row, kept there at any width by
 * {@link useRowOverflow}, and the ways of looking at the text beside them.
 */
export function RichMathEditorToolbar({
  config,
  preview,
  onExpand,
  onEdit,
  onInsert,
  onImageClick,
  onAttachmentClick,
}: RichMathEditorToolbarProps) {
  // Editor translations
  const tEditor = useTranslations('ui.editor')

  // Whether the reader is on a Mac
  const { isMac } = useDeviceCapabilities()

  // The modifier key's symbol (⌘ on Mac, Ctrl elsewhere)
  const modifier = isMac ? '⌘' : 'Ctrl'

  // The localized words some tools write into the text
  const transformLabels: TransformLabels = {
    spoilerLabel: tEditor('hiddenText'),
    spoilerPlaceholder: tEditor('hiddenContentPlaceholder'),
    headingPlaceholder: tEditor('headingPlaceholder'),
  }

  // Every tool there is, in the order they stand, which is also the order a narrowing toolbar holds on to
  // them in
  const everyTool: ToolbarTool[] = [
    pressTool('bold', <Bold />, tEditor('bold', { modifier }), () => onEdit(applyBold)),
    pressTool('italic', <Italic />, tEditor('italic', { modifier }), () => onEdit(applyItalic)),
    pressTool('inlineMath', '$', tEditor('inlineMath', { modifier }), () =>
      onEdit(applyInlineMath)
    ),
    pressTool('blockMath', '$$', tEditor('blockMath'), () => onEdit(insertBlockMath)),
    {
      item: 'symbols',
      render: (closeOverflow) => (
        <RichMathEditorLaTeXSymbolPicker
          isRow={closeOverflow !== null}
          onSymbolClick={(command, args) => {
            // The list the picker was opened from, if any, goes first, as it does for a pressed tool
            closeOverflow?.()

            // And the symbol lands where the cursor stands
            onEdit((context) => insertLatexCommand(context, command, args))
          }}
        />
      ),
    },
    pressTool('image', <ImageIcon />, tEditor('image'), onImageClick),
    {
      item: 'emoji',
      render: (closeOverflow) => (
        <RichMathEditorEmojiPicker
          isRow={closeOverflow !== null}
          onEmojiClick={(emoji) => {
            // The list the picker was opened from, if any, goes first, as it does for a pressed tool
            closeOverflow?.()

            // And the emoji lands where the cursor stands
            onInsert(emoji)
          }}
        />
      ),
    },
    pressTool('numberedList', <ListOrdered />, tEditor('numberedList'), () =>
      onEdit(applyNumberedList)
    ),
    pressTool('bulletList', <List />, tEditor('bulletList'), () => onEdit(applyBulletList)),
    pressTool('quote', <MessageSquareQuote />, tEditor('quote'), () => onEdit(applyQuote)),
    pressTool('heading', <Heading3 />, tEditor('heading'), () =>
      onEdit((context) => insertHeading(context, transformLabels))
    ),
    pressTool('link', <Link />, tEditor('link', { modifier }), () => onEdit(insertLink)),
    pressTool('spoiler', <SquareSlash />, tEditor('spoiler'), () =>
      onEdit((context) => insertSpoiler(context, transformLabels))
    ),
    pressTool('attachment', <Paperclip />, tEditor('attachment'), onAttachmentClick),
  ]

  // The tools this editor shows
  const tools = everyTool.filter((tool) => showsToolbarItem(config, tool.item))

  // How many tools the row has room for, and whether the controls beside it go down to their marks
  const { attachRow, visibleCount, isNeighbourCompact } = useRowOverflow<HTMLDivElement>(
    tools.length
  )

  // Whether the preview stands in for the text
  const isPreviewShown = preview?.isShown ?? false

  // The tools, then the ways of looking at the text
  return (
    <div className="flex items-center gap-2 px-1 pt-1">
      {/* The tools on their one row, set aside while the preview is up */}
      <div
        ref={attachRow}
        // Nothing for the tools to act on while the preview stands in for the text
        inert={isPreviewShown}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden transition-opacity',
          isPreviewShown && 'opacity-40'
        )}
      >
        {/* The tools the row has room for */}
        {tools.slice(0, visibleCount).map((tool) => (
          <Fragment key={tool.item}>{tool.render(null)}</Fragment>
        ))}

        {/* The tools the row has no room for, listed behind a control of their own */}
        {visibleCount < tools.length && (
          <RichMathEditorPicker
            mark={<Plus />}
            title={tEditor('moreOptions')}
            isRow={false}
            popupClassName="w-72 overflow-y-auto p-1"
          >
            {(close) =>
              tools
                .slice(visibleCount)
                .map((tool) => <Fragment key={tool.item}>{tool.render(close)}</Fragment>)
            }
          </RichMathEditorPicker>
        )}
      </div>

      {/* The ways of looking at the text */}
      {(preview || onExpand) && (
        <div className="flex shrink-0 items-center gap-0.5">
          {/* The switch between the text and its preview */}
          {preview && (
            <ToolbarButton
              onClick={preview.toggle}
              mark={<Eye />}
              title={tEditor('preview')}
              isPressed={preview.isShown}
              disabled={!preview.isEnabled}
            >
              {!isNeighbourCompact && tEditor('preview')}
            </ToolbarButton>
          )}

          {/* The control that opens the expanded editor */}
          {onExpand && (
            <ToolbarButton onClick={onExpand} mark={<Expand />} title={tEditor('expandEditor')}>
              {!isNeighbourCompact && tEditor('expand')}
            </ToolbarButton>
          )}
        </div>
      )}
    </div>
  )
}
