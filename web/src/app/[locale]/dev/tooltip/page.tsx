'use client'

import { useMounted, useTimeout } from '@mantine/hooks'
import { useState } from 'react'

import { Tooltip } from '@/components/shared/components/Tooltip'

/** How long the tooltip's content stays one line tall after it appears. The tooltip picks its side well before. */
const GROWTH_DELAY_MS = 300

/**
 * Dev-only harness for the {@link Tooltip}: a trigger near the foot of the screen. Its tooltip asks to open below
 * it, then grows taller than the room left there, while the room above holds all of it.
 */
export default function TooltipPage() {
  // Whether the page has mounted in the browser
  const isMounted = useMounted()

  // Nothing until then, so the trigger only shows once hovering it can open the tooltip
  if (!isMounted) return null

  // The trigger at the foot of the screen, a little room left under it
  return (
    <div className="flex h-dvh flex-col items-start justify-end px-4 pb-40">
      <Tooltip placement="bottom-start" content={<GrowingContent />}>
        <button type="button">Show the tooltip</button>
      </Tooltip>
    </div>
  )
}

/**
 * Content one line tall as it appears and far taller a moment later, the way a figure takes its room once loaded.
 */
function GrowingContent() {
  // Whether the content has grown
  const [isTall, setIsTall] = useState(false)

  // Grown a moment after it appears
  useTimeout(() => setIsTall(true), GROWTH_DELAY_MS, { autoInvoke: true })

  // The line, standing tall once grown
  return (
    <p className={isTall ? 'h-72' : undefined}>
      A tooltip whose content takes its full height only once it is open.
    </p>
  )
}
