'use client'

import { useElementSize } from '@mantine/hooks'

/**
 * Props for the {@link NewsEquationCover} component.
 */
type NewsEquationCoverProps = {
  /** Pre-rendered KaTeX HTML. */
  html: string
}

/**
 * Renders a KaTeX expression scaled to fit its cover panel. The equation is
 * measured against the available space and shrunk so a long formula never spills
 * out of the panel (the panel is narrow, equations are arbitrary width).
 */
export function NewsEquationCover({ html }: NewsEquationCoverProps) {
  // The padded panel the equation must fit inside
  const { ref: panelRef, width: panelWidth, height: panelHeight } = useElementSize()

  // The equation at its natural size; the scale transform we apply doesn't affect the measured box
  const { ref: contentRef, width: naturalWidth, height: naturalHeight } = useElementSize()

  // Shrink to whichever axis is tighter, never upscale; stay at 1 until everything is measured
  const measured = panelWidth && panelHeight && naturalWidth && naturalHeight
  const scale = measured ? Math.min(1, panelWidth / naturalWidth, panelHeight / naturalHeight) : 1

  return (
    <div ref={panelRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      <div
        ref={contentRef}
        className="whitespace-nowrap text-2xl text-slate-800"
        style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
