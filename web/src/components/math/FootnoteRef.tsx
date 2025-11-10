'use client'

import React from 'react'

import { Tooltip } from '../shared/components/Tooltip'

/**
/**
 * Renders a footnote reference icon that displays footnote content in a floating popover
 * by reusing the generic Tooltip component.
 *
 * @param {React.ReactNode} props.children - The content to display inside the footnote popover.
 */
export default function FootnoteRef({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip
      content={<div className="max-w-none">{children}</div>}
      className={
        'z-[1000] min-w-[150px] max-w-[300px] !bg-slate-900/95 border border-white/10 shadow-xl !rounded-md !text-gray-200 article--math footnote-popover'
      }
      placement="top"
    >
      <span className="group inline-block align-super footnote-ref font-bold text-blue-600 cursor-help">
        †
      </span>
    </Tooltip>
  )
}
