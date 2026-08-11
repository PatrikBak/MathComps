'use client'

import * as React from 'react'

import { Tooltip } from '../shared/components/Tooltip'

/**
 * Renders a footnote reference icon that displays footnote content in a floating popover
 * by reusing the generic {@link Tooltip} component.
 */
export default function FootnoteRef({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip
      content={<div className="max-w-none">{children}</div>}
      className={
        'z-floating min-w-[150px] max-w-[300px] !bg-surface/95 border border-foreground/10 shadow-xl !rounded-md !text-foreground math-typography footnote-popover'
      }
      placement="top"
    >
      <span className="group inline-block align-super footnote-ref font-bold text-link cursor-help">
        †
      </span>
    </Tooltip>
  )
}
