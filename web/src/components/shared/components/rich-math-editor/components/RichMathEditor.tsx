'use client'

import type { FocusEvent, ReactNode } from 'react'
import { useImperativeHandle, useMemo } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { useEditorKeyboard } from '../hooks/use-editor-keyboard'
import { useEditorText } from '../hooks/use-editor-text'
import { useEditorUploads } from '../hooks/use-editor-uploads'
import { useExpandedEditor } from '../hooks/use-expanded-editor'
import { RichMathEditorFooter } from './RichMathEditorFooter'
import { RichMathEditorFrame } from './RichMathEditorFrame'
import { RichMathEditorExpandedModal } from './RichMathEditorModal'
import { RichMathEditorPane } from './RichMathEditorPane'

/**
 * Visual variants for the {@link RichMathEditor}, each a fill, or none, for the frame its parts sit in.
 * - 'card': a card-style fill
 * - 'inline': no fill of its own, the page showing through
 */
export type RichMathEditorVariant = 'card' | 'inline'

/**
 * A toolbar entry that can be shown or hidden per editor instance.
 */
export type ToolbarItem =
  | 'bold'
  | 'italic'
  | 'inlineMath'
  | 'blockMath'
  | 'symbols'
  | 'numberedList'
  | 'bulletList'
  | 'quote'
  | 'heading'
  | 'link'
  | 'spoiler'
  | 'attachment'
  | 'image'
  | 'emoji'

/**
 * Which toolbar entries an editor shows: every entry is on unless set to `false`.
 */
export type ToolbarConfig = Partial<Record<ToolbarItem, boolean>>

/**
 * Whether a toolbar entry is shown under a config.
 *
 * @param config - The editor's toolbar config, if any.
 * @param item - The entry to check.
 *
 * @returns Whether the entry is shown.
 */
export function showsToolbarItem(config: ToolbarConfig | undefined, item: ToolbarItem): boolean {
  // An omitted entry is on
  return config?.[item] ?? true
}

/**
 * Handle exposed by the {@link RichMathEditor} component.
 */
export type RichMathEditorRef = {
  /** Puts the cursor in the editor. */
  focus: () => void
}

/**
 * Props for the {@link RichMathEditor} component.
 */
type RichMathEditorProps = {
  /** Visual variant of the editor */
  variant?: RichMathEditorVariant
  /** Which toolbar entries to show */
  toolbar?: ToolbarConfig
  /** The editor's minimum height in px */
  minHeightPx?: number
  /** The most characters the content may hold, or null for no limit */
  maxCharacters: number | null
  /** Current text value */
  value: string
  /** Callback when the text changes */
  onChange: (value: string) => void
  /** Callback when focus leaves the inline editor, its toolbar and footer included */
  onBlur?: () => void
  /** The id of the text field */
  id?: string
  /** Placeholder text */
  placeholder?: string
  /** Whether to auto-focus */
  autoFocus?: boolean
  /** Additional className for the wrapper */
  className?: string
  /** Sends the draft, from the send button or ⌘/Ctrl+Enter; the button shows only where this is given */
  onSend?: () => void
  /**
   * Whether the surface allows a send now; the editor's own validity and a send in flight gate on top
   * of it
   */
  canSend?: boolean
  /** Cancels the editor, from the cancel button beside the send or from Escape */
  onCancel?: () => void
  /** Callback that stops the in-flight submit */
  onStop?: () => void
  /** Whether a phone opens the editor straight into its expanded view, with no inline one under it */
  autoExpandOnMobile?: boolean
  /** Whether the editor is in a loading state (e.g. sending) */
  isLoading?: boolean
  /** What the surface using the editor counts of its own */
  footerMeta?: ReactNode
  /** Handle onto the editor's imperative controls */
  ref?: React.Ref<RichMathEditorRef>
}

/**
 * A Markdown editor for writing with math, with a preview of what the text renders as: in place of the
 * text, or beside it in an expanded view.
 */
export function RichMathEditor({
  variant = 'card',
  toolbar,
  minHeightPx = 200,
  maxCharacters,
  value,
  onChange,
  onBlur,
  id,
  placeholder = '',
  autoFocus = false,
  className,
  onSend,
  canSend = true,
  onCancel,
  onStop,
  autoExpandOnMobile = false,
  isLoading = false,
  footerMeta,
  ref,
}: RichMathEditorProps) {
  // The limits the text is held to, the same object until a limit changes
  const config = useMemo(() => ({ maxCharacters }), [maxCharacters])

  // The text, what it measures up to and the edits it takes. No send may go while one is on its way
  const text = useEditorText({ value, onChange, canSend: canSend && !isLoading, config })

  // The keys the text answers
  const { handleKeyDown } = useEditorKeyboard({ text, onSend, onCancel })

  // The ways content other than typing reaches the text, taking only the files its toolbar offers
  const uploads = useEditorUploads({
    text,
    allowImageUpload: showsToolbarItem(toolbar, 'image'),
    allowAttachmentUpload: showsToolbarItem(toolbar, 'attachment'),
  })

  // Hand the caller the cursor on demand; autoFocus only offers it at mount
  useImperativeHandle(ref, () => ({ focus: () => text.textareaRef.current?.focus() }), [
    text.textareaRef,
  ])

  // The expanded view
  const expanded = useExpandedEditor({ text, autoExpandOnMobile, onSend, onCancel })

  /**
   * A function which reports focus leaving the inline editor. Focus moving from the text field to a
   * toolbar button is still inside it, so only focus landing outside counts.
   *
   * @param event - The focus leaving one of the inline editor's parts.
   */
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    // Focus still somewhere inside the inline editor
    if (event.currentTarget.contains(event.relatedTarget)) return

    // Focus has left the inline editor
    onBlur?.()
  }

  // The inline editor, and the expanded view it opens into
  return (
    <>
      {/* The inline editor, absent where the expanded view is the whole editor */}
      {!expanded.isOnlyEditor && (
        <div className={cn('flex-1 flex flex-col w-full max-w-4xl', className)} onBlur={handleBlur}>
          <RichMathEditorFrame
            variant={variant}
            minHeightPx={minHeightPx}
            opensTall={false}
            resizeRatio={1}
          >
            {/* Toolbar and text */}
            <RichMathEditorPane
              text={text}
              uploads={uploads}
              toolbarConfig={toolbar}
              id={id}
              placeholder={placeholder}
              autoFocus={autoFocus}
              onKeyDown={handleKeyDown}
              canPreview
              onExpand={expanded.open}
            />

            {/* Footer bar */}
            <RichMathEditorFooter
              state={text.state}
              escapeCancels
              meta={footerMeta}
              onSend={onSend}
              onCancel={onCancel}
              onStop={onStop}
              isSendable={text.isSendable}
              isLoading={isLoading}
            />
          </RichMathEditorFrame>
        </div>
      )}

      {/* The expanded view, mounted throughout so it can say when it has closed */}
      <RichMathEditorExpandedModal
        expanded={expanded}
        // The dialog hands focus back to what had it before it opened, which can be the toolbar's expand
        // control, so the editor has to ask for the cursor itself once its own textarea is the one on screen
        // again
        onClosed={() => text.textareaRef.current?.focus()}
        text={text}
        uploads={uploads}
        toolbarConfig={toolbar}
        placeholder={placeholder}
        onStop={onStop}
        isLoading={isLoading}
        footerMeta={footerMeta}
      />
    </>
  )
}
