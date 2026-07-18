import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useIsMobile } from '@/hooks/use-breakpoint'

import { Modal } from '../../Modal'
import { type EditorViewModel } from '../hooks/use-editor-model'
import { showsToolbarItem, type ToolbarConfig } from './RichMathEditor'
import { RichMathEditorFooter } from './RichMathEditorFooter'
import { RichMathEditorInputArea } from './RichMathEditorInputArea'
import { RichMathEditorRenderer } from './RichMathEditorRenderer'
import { RichMathEditorToolbar } from './RichMathEditorToolbar'

/**
 * Props for the {@link RichMathEditorExpandedModal} component.
 */
type RichMathEditorExpandedModalProps = {
  /** Whether the modal is currently open */
  isOpen: boolean
  /** Callback to close the modal */
  onClose: () => void
  /** Shared viewModel from the parent RichMathEditor */
  viewModel: EditorViewModel
  /** Which toolbar entries to show; every entry defaults to on */
  toolbarConfig?: ToolbarConfig
  /** Placeholder text shown when the editor is empty */
  placeholder: string
  /** Callback triggered when the send button is clicked */
  onSend?: () => void
  /** Callback triggered when the cancel button is clicked */
  onCancel?: () => void
  /** Callback that stops the in-flight submit. */
  onStop?: () => void
  /** Whether the editor is in a loading state */
  isLoading?: boolean
}

/**
 * Expanded modal view for the {@link RichMathEditor}. Uses the same
 * {@link EditorViewModel} as the inline editor which is the way to ensure
 * consistent functionality.
 */
export function RichMathEditorExpandedModal({
  isOpen,
  onClose,
  viewModel,
  toolbarConfig,
  placeholder,
  onSend,
  onCancel,
  onStop,
  isLoading = false,
}: RichMathEditorExpandedModalProps) {
  // Get translations
  const tEditor = useTranslations('ui.editor')

  // Check if we're on mobile where we have editor and preview as tabs
  const isMobile = useIsMobile()

  // Keep track of which view we're in on mobile
  const [mobileModalView, setMobileModalView] = useState<'editor' | 'preview'>('editor')

  // Extract viewModel properties
  const {
    state,
    inputAreaRef,
    applyTransform,
    insertAtCursor,
    openImagePicker: openFilePicker,
    openAttachmentPicker,
    handleChange,
    handleKeyDown,
  } = viewModel

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tEditor('expandedEditor')}
      showCloseButton
      className="flex flex-col max-h-[95vh] md:max-h-[90vh] md:max-w-6xl"
    >
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden -mx-6 -mb-6 px-4 md:px-6 pb-4 md:pb-6">
        {/* Mobile: Tab switcher */}
        <div className="md:hidden flex border-b border-foreground/10 mb-2">
          <button
            type="button"
            onClick={() => setMobileModalView('editor')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              mobileModalView === 'editor'
                ? 'text-brand-light border-b-2 border-brand-light'
                : 'text-muted hover:text-foreground'
            )}
          >
            {tEditor('expandedEditor')}
          </button>
          <button
            type="button"
            onClick={() => setMobileModalView('preview')}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              mobileModalView === 'preview'
                ? 'text-brand-light border-b-2 border-brand-light'
                : 'text-muted hover:text-foreground'
            )}
          >
            {tEditor('preview')}
          </button>
        </div>

        {/* Editor and Preview container */}
        <div className="flex-1 flex flex-col overflow-hidden border border-foreground/10 rounded-lg">
          {/* Top row: Editor + Preview */}
          <div className="flex-1 grid grid-cols-1 grid-rows-1 md:flex md:flex-row min-h-0 overflow-hidden">
            {/* Left: Editor panel */}
            <div
              className={cn(
                'col-start-1 row-start-1 flex flex-col min-h-0 md:flex-1 md:max-h-[calc(90vh-10rem)] overflow-hidden',
                isMobile && mobileModalView !== 'editor' && 'invisible'
              )}
            >
              {/* Toolbar */}
              <RichMathEditorToolbar
                variant="card"
                config={toolbarConfig}
                borderless
                onEdit={applyTransform}
                onInsert={insertAtCursor}
                onImageClick={openFilePicker}
                onAttachmentClick={openAttachmentPicker}
              />

              {/* Expanded Textarea - flex to match preview height */}
              <RichMathEditorInputArea
                ref={inputAreaRef}
                variant="card"
                borderless
                viewModel={viewModel}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                allowImageUpload={showsToolbarItem(toolbarConfig, 'image')}
                allowAttachmentUpload={showsToolbarItem(toolbarConfig, 'attachment')}
                containerClassName="flex-1 min-h-0 min-h-[200px]"
                className="h-full"
                autoFocus
              />
            </div>

            {/* Vertical divider (desktop only) */}
            <div className="hidden md:block w-px bg-foreground/10 flex-shrink-0" />

            {/* Right: Preview panel */}
            <div
              className={cn(
                'col-start-1 row-start-1 md:col-auto md:row-auto md:w-1/2 md:flex-shrink-0 md:max-h-[calc(90vh-8rem)] overflow-hidden flex flex-col',
                isMobile && mobileModalView !== 'preview' && 'invisible',
                !isMobile && 'md:block'
              )}
            >
              <div className="h-full flex flex-col overflow-y-auto">
                {/* Header - desktop only */}
                <div className="hidden md:block sticky top-0 z-10 px-4 pt-3 pb-2 bg-surface/80 text-xs text-muted uppercase tracking-wide font-medium">
                  {tEditor('preview')}
                </div>
                {/* Content */}
                <div className="flex-1 px-4 py-3 text-sm text-muted-foreground leading-relaxed min-h-[200px] bg-surface-inset/50">
                  {state.hasContent && (
                    <RichMathEditorRenderer
                      content={state.text}
                      lightImageBackground={false}
                      imageContext="comments"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <RichMathEditorFooter
            variant="card"
            borderless
            modeConfig={{ mode: 'expanded' }}
            charCount={state.metrics.charCount}
            imageCount={state.metrics.imageCount}
            attachmentCount={state.metrics.attachmentCount}
            onSend={() => {
              onClose()
              onSend?.()
            }}
            onCancel={
              // Only wire a cancel when there's a real one to run; otherwise the footer X would just
              // close the modal, duplicating the header's close button
              onCancel
                ? () => {
                    onClose()
                    onCancel()
                  }
                : undefined
            }
            onStop={onStop}
            isValid={state.isValid}
            isLoading={isLoading}
          />
        </div>
      </div>
    </Modal>
  )
}
