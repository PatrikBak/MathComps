import { Resizable } from 're-resizable'
import { type ReactNode, useCallback, useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { type RichMathEditorVariant } from './RichMathEditor'

/**
 * The fill, if any, of an editor's frame under each variant.
 */
const FRAME_FILL: Record<RichMathEditorVariant, string> = {
  card: 'bg-surface-inset/50',
  inline: '',
}

/**
 * Props for the {@link RichMathEditorFrame} component.
 */
type RichMathEditorFrameProps = {
  /** Visual variant of the editor the frame is drawn for */
  variant: RichMathEditorVariant
  /** The least height the frame stands at, in px, where its surface names one */
  minHeightPx: number | undefined
  /**
   * Whether the frame opens at the most height its surface has for it, which the surface's classes set,
   * where it otherwise opens as tall as its parts make it
   */
  opensTall: boolean
  /**
   * How many pixels the frame grows for each one its edge is dragged: one for a frame held by an edge,
   * two for a frame held by its middle, whose dragged edge would otherwise move half as far as the
   * pointer.
   */
  resizeRatio: number
  /** Classes for where the frame stands */
  className?: string
  /** The editor's parts */
  children: ReactNode
}

/**
 * The frame an editor's parts sit in: one border and one fill around all of them, lit the way a form
 * field is while the text has the cursor. The reader makes it taller or shorter by dragging its bottom
 * edge.
 */
export function RichMathEditorFrame({
  variant,
  minHeightPx,
  opensTall,
  resizeRatio,
  className,
  children,
}: RichMathEditorFrameProps) {
  // How tall the frame lands, unknown until it is on screen. It is the least the frame is dragged down
  // to, since anything under it cuts into the parts or goes under the surface's least height
  const [landingHeightPx, setLandingHeightPx] = useState<number | null>(null)

  // The height the reader dragged the frame to, none until they do
  const [draggedHeightPx, setDraggedHeightPx] = useState<number | null>(null)

  /**
   * A function which reads how tall the frame lands.
   *
   * @param resizable - The frame, or null as it goes.
   */
  const attachFrame = useCallback((resizable: Resizable | null) => {
    // The frame's own element, none as the frame goes
    const frame = resizable?.resizable
    if (!frame) return

    // How tall the frame lands, read before it is first painted
    setLandingHeightPx(frame.offsetHeight)
  }, [])

  // Undragged, a frame that opens tall asks for the whole screen and gets what its surface's limit
  // leaves of it. It asks only once its landing height is read, which takes it first standing as tall as
  // its parts
  const openHeight = opensTall && landingHeightPx !== null ? '100vh' : 'auto'

  // The frame around the editor's parts
  return (
    <Resizable
      ref={attachFrame}
      size={{ width: '100%', height: draggedHeightPx ?? openHeight }}
      minHeight={landingHeightPx ?? minHeightPx}
      resizeRatio={resizeRatio}
      enable={{ bottom: true }}
      handleComponent={{
        bottom: (
          // The grip, across the frame's border with most of it on the inside
          <div className="group/resizer flex h-full w-full cursor-ns-resize items-start justify-center pt-0.5">
            <div className="h-1 w-12 rounded-full bg-foreground/10 transition-colors group-hover/resizer:bg-brand/50" />
          </div>
        ),
      }}
      // The height the frame came to, which its surface's limit can leave short of where the drag went
      onResizeStop={(_event, _direction, frame) => setDraggedHeightPx(frame.offsetHeight)}
      className={cn(
        'relative flex flex-col rounded-lg border border-foreground/10 transition-[border-color,box-shadow]',
        'has-[textarea:focus-visible]:border-focus/70',
        'has-[textarea:focus-visible]:ring-2 has-[textarea:focus-visible]:ring-focus/30',
        FRAME_FILL[variant],
        className
      )}
    >
      {children}
    </Resizable>
  )
}
