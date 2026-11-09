'use client'

import { useElementSize } from '@mantine/hooks'
import type { ReactNode } from 'react'

/**
 * Props for the {@link ScaledContent} component.
 */
type ScaledContentProps = {
  /** The size the content is drawn at, as a fraction of its own. */
  scale: number
  /** The content drawn smaller. */
  children: ReactNode
}

/**
 * Content laid out at its own size and drawn smaller with a transform, in a box shrunk to the drawing. Its text
 * keeps its font sizes, which keeps it clear of Safari's 9px floor on relatively sized text: under `zoom`, the
 * smallest text stops shrinking while the layout around it goes on, and math typeset in `em` falls apart. It lays
 * itself out across its container's width divided by the scale, so the container needs a definite width.
 */
export function ScaledContent({ scale, children }: ScaledContentProps) {
  // The content's height at its own size, which the transform leaves untouched
  const { ref, height } = useElementSize<HTMLDivElement>()

  // The box the drawing takes, the content's height shrunk by the scale
  return (
    <div className="overflow-hidden" style={{ height: height * scale }}>
      {/* The content, laid out wider by the scale and drawn smaller from its top-left corner */}
      <div
        ref={ref}
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}
