'use client'

import { Modal } from '@/components/shared/components/Modal'

/**
 * Props for the {@link PromptTextModal} component.
 */
type PromptTextModalProps = {
  /** Which step's template it is. */
  title: string
  /** The template, uninterpolated; null while none is being read. */
  text: string | null
  /** Closes it. */
  onClose: () => void
}

/**
 * One prompt template, read at full width.
 *
 * The templates are thousands of characters of instructions written as prose, and a side panel narrow enough
 * to break "examiner" across two lines is not somewhere they can be read. They keep their monospace and their
 * line breaks, because they carry placeholder syntax and dollar signs that markdown and maths rendering would
 * mangle rather than show, but at a size and a measure meant for reading rather than for glancing at.
 *
 * The text is focusable and named, since a region that only scrolls is otherwise out of reach from the
 * keyboard. Hyphenation is off: the page turns it on for prose, and on a template it was breaking words that
 * have to be read exactly as they were written.
 */
export function PromptTextModal({ title, text, onClose }: PromptTextModalProps) {
  return (
    <Modal
      isOpen={text !== null}
      onClose={onClose}
      title={title}
      showCloseButton
      align="top"
      className="flex max-w-4xl flex-col sm:max-h-[85vh]"
    >
      {/* The template itself */}
      <pre
        tabIndex={0}
        role="region"
        aria-label={title}
        className="scrollbar-visible min-h-0 flex-1 overflow-auto overscroll-contain whitespace-pre-wrap hyphens-none rounded-lg bg-background/60 p-4 font-mono text-sm leading-relaxed text-muted-foreground"
      >
        {text}
      </pre>
    </Modal>
  )
}
