'use client'

import { Resizable } from 're-resizable'
import { useEffect, useState } from 'react'

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
 * Props for the {@link RichMathEditor} component.
 */
type RichMathEditorProps = {
  /** Visual variant of the editor */
  variant?: RichMathEditorVariant
  /** Current text value */
  value: string
  /** Callback when the text changes */
  onChange: (value: string) => void
  /** Placeholder text (default: empty) */
  placeholder?: string
  /** Whether to auto-focus (default: false) */
  autoFocus?: boolean
  /** Additional className for the wrapper */
  className?: string
  /** Callback when the content validity changes */
  onValidChange?: (isValid: boolean) => void
  /** Callback when send button is clicked (shows send button when provided) */
  onSend?: () => void
  /** Callback when cancel button is clicked (shows cancel button when provided) */
  onCancel?: () => void
  /** Auto-expand to modal on mobile (for replies on small screens) */
  autoExpandOnMobile?: boolean
  /** Whether the editor is in a loading state (e.g. sending) */
  isLoading?: boolean
}

/**
 * A Markdown-based editor with an expanded view with a preview.
 */
export function RichMathEditor({
  variant = 'card',
  value,
  onChange,
  placeholder = '',
  autoFocus = false,
  className,
  onValidChange,
  onSend,
  onCancel,
  autoExpandOnMobile,
  isLoading = false,
}: RichMathEditorProps) {
  // All the logic is in the view-model and provided to the view
  const viewModel = useEditorModel({ value, onChange, onSend, onCancel })
  const {
    state,
    inputAreaRef,
    applyTransform,
    insertAtCursor,
    openImagePicker,
    openAttachmentPicker,
    handleChange,
    handleKeyDown,
  } = viewModel

  // Track modal state
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Check if we are on mobile where we might want to expand to modal
  const isMobile = useIsMobile()

  // Auto-expand to modal on mobile
  useEffect(() => {
    if (autoExpandOnMobile && isMobile === true) {
      setIsModalOpen(true)
    }
  }, [autoExpandOnMobile, isMobile])

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange?.(state.isValid)
  }, [state.isValid, onValidChange])

  // Whether we're in mobile modal-only mode (no inline content)
  const isMobileModalOnly = autoExpandOnMobile && isMobile

  return (
    <>
      {/* Wrapper for inline editor - hidden on mobile when using modal-only mode */}
      {!isMobileModalOnly && (
        <div className={cn('flex-1 flex flex-col w-full max-w-4xl', className)}>
          {/* Editor container - hidden on mobile when autoExpandOnMobile is active */}
          {!(autoExpandOnMobile && isMobile !== false) && (
            <Resizable
              defaultSize={{ width: '100%', height: 'auto' }}
              minHeight={200}
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
                    <div className="w-12 h-1 bg-foreground/10 rounded-full transition-colors group-hover/resizer:bg-focus/50 mt-0.5" />
                  </div>
                ),
              }}
              className="flex flex-col relative"
            >
              {/* Toolbar */}
              <RichMathEditorToolbar
                variant={variant}
                onEdit={applyTransform}
                onInsert={insertAtCursor}
                onImageClick={openImagePicker}
                onAttachmentClick={openAttachmentPicker}
              />

              {/* Editor Input Area */}
              <RichMathEditorInputArea
                variant={variant}
                ref={inputAreaRef}
                viewModel={viewModel}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                autoFocus={autoFocus}
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
                  isValid={state.isValid}
                  isLoading={isLoading}
                />
              )}
            </Resizable>
          )}
        </div>
      )}

      {/* Expanded Modal - always rendered for portal to work */}
      <RichMathEditorExpandedModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        viewModel={viewModel}
        placeholder={placeholder}
        onSend={onSend}
        onCancel={onCancel}
        isLoading={isLoading}
      />
    </>
  )
}
