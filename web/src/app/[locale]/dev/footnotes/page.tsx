'use client'

import { useDisclosure } from '@mantine/hooks'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

import { HARNESS_COPY, HARNESS_TEXTS, markdownOf } from './footnotes-harness'

/**
 * Dev-only harness for footnotes in the {@link RichMathEditorRenderer}: a dialog scrolling two texts, each drawn by a
 * renderer of its own and each with a footnote numbered 1, so the two renderers' footnotes share a number.
 */
export default function FootnotesPage() {
  // Whether the dialog is open
  const [isDialogOpen, { open: openDialog, close: closeDialog }] = useDisclosure(false)

  // The button, then the dialog it opens
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Button variant="secondary" onClick={openDialog}>
        {HARNESS_COPY.openDialog}
      </Button>
      <Modal
        isOpen={isDialogOpen}
        onClose={closeDialog}
        title={HARNESS_COPY.dialogTitle}
        showCloseButton
        tall
      >
        {/* Texts, scrolled inside the dialog */}
        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto">
          {HARNESS_TEXTS.map((text) => (
            <section key={text.title} aria-label={text.title}>
              <RichMathEditorRenderer content={markdownOf(text)} />
            </section>
          ))}
        </div>
      </Modal>
    </div>
  )
}
