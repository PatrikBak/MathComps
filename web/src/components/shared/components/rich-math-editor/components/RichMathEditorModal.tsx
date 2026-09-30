import { Eye } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { useIsMobile } from '@/hooks/use-breakpoint'

import { Modal } from '../../Modal'
import { type UseEditorTextResult } from '../hooks/use-editor-text'
import { type UseEditorUploadsResult } from '../hooks/use-editor-uploads'
import { type UseExpandedEditorResult } from '../hooks/use-expanded-editor'
import { type ToolbarConfig } from './RichMathEditor'
import { RichMathEditorFooter } from './RichMathEditorFooter'
import { RichMathEditorFrame } from './RichMathEditorFrame'
import { RichMathEditorPane } from './RichMathEditorPane'
import { RichMathEditorPreview } from './RichMathEditorPreview'

/**
 * Props for the {@link RichMathEditorExpandedModal} component.
 */
type RichMathEditorExpandedModalProps = {
  /** The expanded view's state and the ways in and out of it */
  expanded: UseExpandedEditorResult
  /** Called once the dialog closes, as in {@link Modal} */
  onClosed: () => void
  /** The text the expanded view shows and edits */
  text: UseEditorTextResult
  /** The ways content other than typing reaches the text */
  uploads: UseEditorUploadsResult
  /** Which toolbar entries to show */
  toolbarConfig: ToolbarConfig | undefined
  /** Placeholder text shown when the editor is empty */
  placeholder: string
  /** Callback that stops the in-flight submit */
  onStop: (() => void) | undefined
  /** Whether a submit is in flight */
  isLoading: boolean
  /** What the surface counts of its own */
  footerMeta: ReactNode
}

/**
 * Expanded modal view for the rich math editor. Where there is room, the preview stands beside the
 * text; on a phone the toolbar's own preview toggle swaps between them.
 */
export function RichMathEditorExpandedModal({
  expanded,
  onClosed,
  text,
  uploads,
  toolbarConfig,
  placeholder,
  onStop,
  isLoading,
  footerMeta,
}: RichMathEditorExpandedModalProps) {
  // Editor translations
  const tEditor = useTranslations('ui.editor')

  // Whether the viewport is phone-width
  const isMobile = useIsMobile()

  // The expanded editor, in a dialog of its own
  return (
    <Modal
      isOpen={expanded.isOpen}
      onClose={expanded.close}
      onClosed={onClosed}
      title={tEditor('expandedEditor')}
      showCloseButton
      className="md:max-w-6xl"
    >
      <div className="-mx-6 -mb-6 px-4 md:px-6 pt-0.5 pb-4 md:pb-6">
        {/* The editor, its preview and its footer, in one frame */}
        <RichMathEditorFrame
          variant="card"
          minHeightPx={undefined}
          opensTall
          // Held by its middle, the dialog standing in the middle of the screen
          resizeRatio={2}
          // As tall as the screen has room for under the dialog's own heading and margins
          className="max-h-[calc(100dvh-9rem)]"
        >
          {/* The panels */}
          <div className="flex-1 flex min-h-0 overflow-hidden">
            {/* The text */}
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
              <RichMathEditorPane
                text={text}
                uploads={uploads}
                toolbarConfig={toolbarConfig}
                placeholder={placeholder}
                autoFocus
                onKeyDown={expanded.handleKeyDown}
                canPreview={isMobile}
                onExpand={null}
                // The text under a rule where the preview stands beside it, level with the preview's own
                textClassName={cn(
                  'min-h-[200px]',
                  !isMobile && 'mt-1 border-t border-foreground/10'
                )}
              />
            </div>

            {/* The preview beside the text, where there is room for both */}
            {!isMobile && (
              <div className="hidden md:flex md:w-1/2 md:flex-shrink-0 flex-col min-h-0 border-l border-foreground/10">
                {/* The preview's heading, level with the toolbar */}
                <div className="mt-1 flex h-7 shrink-0 items-center gap-1.5 px-3 text-xs text-muted">
                  <Eye size={14} aria-hidden="true" />
                  {tEditor('preview')}
                </div>

                {/* What the text renders as */}
                <RichMathEditorPreview
                  content={text.state.text}
                  className="mt-1 min-h-[200px] flex-1 overflow-y-auto border-t border-foreground/10"
                />
              </div>
            )}
          </div>

          {/* Footer, under a rule where the preview stands beside the text */}
          <RichMathEditorFooter
            state={text.state}
            escapeCancels={expanded.isOnlyEditor}
            meta={footerMeta}
            onSend={expanded.send}
            onCancel={expanded.cancel}
            onStop={onStop}
            isSendable={text.isSendable}
            isLoading={isLoading}
            className={cn(!isMobile && 'border-t border-foreground/10')}
          />
        </RichMathEditorFrame>
      </div>
    </Modal>
  )
}
