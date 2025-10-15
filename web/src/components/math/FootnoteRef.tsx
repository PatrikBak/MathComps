'use client'

import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useHover,
  useInteractions,
  useRole,
} from '@floating-ui/react'
import React from 'react'

// #region Types

type FootnoteRefProps = {
  children: React.ReactNode
}

// #endregion

// #region UI components

/**
 * Renders a footnote reference icon that displays footnote content in a floating popover when clicked or hovered.
 */
export default function FootnoteRef({ children }: FootnoteRefProps) {
  const [open, setOpen] = React.useState(false)

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: 'top-start',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  })

  const hover = useHover(context, { move: false, restMs: 80, mouseOnly: true })
  const click = useClick(context)
  const dismiss = useDismiss(context, {
    outsidePress: true,
    escapeKey: true,
    ancestorScroll: true,
  })
  const role = useRole(context, { role: 'dialog' })
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, click, dismiss, role])

  return (
    <span className="group relative inline-block align-super footnote-ref">
      <span className="font-bold">†</span>
      <button
        ref={refs.setReference}
        {...getReferenceProps({
          onFocus: () => setOpen(true),
        })}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Poznámka"
        className="p-1 -m-1 absolute inset-0 rounded focus:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
      />
      {open && (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps({})}
              role="dialog"
              aria-label="Poznámka"
              className="z-[1000] min-w-[150x] max-w-[300px] bg-slate-900/95 border border-white/10 shadow-xl rounded-md p-3 text-gray-200 article--math footnote-popover"
            >
              <div className="max-w-none">{children}</div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </span>
  )
}

// #endregion
