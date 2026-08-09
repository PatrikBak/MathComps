'use client'

import { Resizable } from 're-resizable'
import { useEffect, useImperativeHandle, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useIsMobile } from '@/hooks/use-breakpoint'

import { useEditorModel } from '../hooks/use-editor-model'
import { RichMathEditorFooter } from './RichMathEditorFooter'
import { RichMathEditorInputArea } from './RichMathEditorInputArea'
import { RichMathEditorExpandedModal } from './RichMathEditorModal'
import { RichMathEditorToolbar } from './RichMathEditorToolbar'

/**
 * Visual variants for the RichMathEditor.
 * - 'card': Default card-style with background and borders (for modals/cards)
 * - 'inline': Minimal styling that blends with page content (for handouts)
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
 * Which toolbar entries an editor shows. Every entry defaults to on, so an omitted or partial config
 * leaves the full toolbar in place; set an entry to `false` to hide it.
 */
export type ToolbarConfig = Partial<Record<ToolbarItem, boolean>>

/**
 * Whether a toolbar entry is shown under a config, every entry defaulting to on.
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
  /** Which toolbar entries to show; every entry defaults to on */
  toolbar?: ToolbarConfig
  /** The editor's minimum height in px */
  minHeightPx?: number
  /** Current text value */
  value: string
  /** Callback when the text changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Whether to auto-focus */
  autoFocus?: boolean
  /** Additional className for the wrapper */
  className?: string
  /** Callback when the content validity changes */
  onValidChange?: (isValid: boolean) => void
  /** Callback when send button is clicked (shows send button when provided) */
  onSend?: () => void
  /** Whether a send is currently allowed; the editor's own validity gates on top of it */
  canSend?: boolean
  /** Callback when cancel button is clicked (shows cancel button when provided) */
  onCancel?: () => void
  /** Callback that stops the in-flight submit. */
  onStop?: () => void
  /** Auto-expand to modal on mobile (for replies on small screens) */
  autoExpandOnMobile?: boolean
  /** Whether the editor is in a loading state (e.g. sending) */
  isLoading?: boolean
  /** Handle onto the editor's imperative controls */
  ref?: React.Ref<RichMathEditorRef>
}

/**
 * A Markdown-based editor with an expanded view with a preview.
 */
export function RichMathEditor({
  variant = 'card',
  toolbar,
  minHeightPx = 200,
  value,
  onChange,
  placeholder = '',
  autoFocus = false,
  className,
  onValidChange,
  onSend,
  canSend = true,
  onCancel,
  onStop,
  autoExpandOnMobile,
  isLoading = false,
  ref,
}: RichMathEditorProps) {
  // All the logic is in the view-model and provided to the view
  const viewModel = useEditorModel({ value, onChange, onSend, canSend, onCancel })
  const {
    state,
    textareaRef,
    inputAreaRef,
    applyTransform,
    insertAtCursor,
    openImagePicker,
    openAttachmentPicker,
    handleChange,
    handleKeyDown,
  } = viewModel

  // Hand the caller the cursor on demand; autoFocus only offers it at mount
  useImperativeHandle(ref, () => ({ focus: () => textareaRef.current?.focus() }), [textareaRef])

  // Track modal state
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Check if we are on mobile where we might want to expand to modal
  const isMobile = useIsMobile()

  // Auto-expand to modal on mobile
  useEffect(() => {
    if (autoExpandOnMobile && isMobile) {
      setIsModalOpen(true)
    }
  }, [autoExpandOnMobile, isMobile])

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange?.(state.isValid)
  }, [state.isValid, onValidChange])

  // Whether we're in mobile modal-only mode (no inline content)
  const isMobileModalOnly = autoExpandOnMobile && isMobile

  // Whether this editor accepts image / attachment uploads
  const allowImageUpload = showsToolbarItem(toolbar, 'image')
  const allowAttachmentUpload = showsToolbarItem(toolbar, 'attachment')

  return (
    <>
      {/* The inline editor, absent on mobile in modal-only mode */}
      {!isMobileModalOnly && (
        <div className={cn('flex-1 flex flex-col w-full max-w-4xl', className)}>
          <Resizable
            defaultSize={{ width: '100%', height: 'auto' }}
            minHeight={minHeightPx}
            enable={{
              top: false,
              right: false,
              bottom: true,
              left: false,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false,
            }}
            handleComponent={{
              bottom: (
                <div className="relative w-full h-1.5 cursor-ns-resize group/resizer flex justify-center -mb-1">
                  <div className="w-12 h-1 bg-foreground/10 rounded-full transition-colors group-hover/resizer:bg-brand/50 mt-0.5" />
                </div>
              ),
            }}
            className="flex flex-col relative"
          >
            {/* Toolbar */}
            <RichMathEditorToolbar
              variant={variant}
              config={toolbar}
              onEdit={applyTransform}
              onInsert={insertAtCursor}
              onImageClick={openImagePicker}
              onAttachmentClick={openAttachmentPicker}
            />

            {/* Editor input area */}
            <RichMathEditorInputArea
              variant={variant}
              ref={inputAreaRef}
              viewModel={viewModel}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              autoFocus={autoFocus}
              allowImageUpload={allowImageUpload}
              allowAttachmentUpload={allowAttachmentUpload}
              containerClassName="flex-1 min-h-0"
              className={cn('h-full', onSend && 'rounded-b-none')}
            />

            {/* Footer bar */}
            {onSend && (
              <RichMathEditorFooter
                variant={variant}
                modeConfig={{ mode: 'inline', onExpand: () => setIsModalOpen(true) }}
                charCount={state.metrics.charCount}
                imageCount={state.metrics.imageCount}
                attachmentCount={state.metrics.attachmentCount}
                onSend={onSend}
                onCancel={onCancel}
                onStop={onStop}
                isValid={state.isValid && canSend}
                isLoading={isLoading}
              />
            )}
          </Resizable>
        </div>
      )}

      {/* The expanded modal, always mounted so its portal works */}
      <RichMathEditorExpandedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        viewModel={viewModel}
        toolbarConfig={toolbar}
        placeholder={placeholder}
        onSend={onSend}
        canSend={canSend}
        onCancel={onCancel}
        onStop={onStop}
        isLoading={isLoading}
      />
    </>
  )
}
