'use client'

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
  Transition,
  TransitionChild,
} from '@headlessui/react'
import { useFocusReturn } from '@mantine/hooks'
import { X } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { cn } from '../utils/css-utils'
import { Button } from './Button'

/**
 * The props of {@link TopSheet}.
 */
type TopSheetProps = {
  /** Whether the sheet is showing. */
  isOpen: boolean
  /** Dismisses the sheet. */
  onClose: () => void
  /** What heads the sheet, beside its close button, and names it. */
  title: ReactNode
  /** What the close button is named. */
  closeLabel: string
  /** Whether what the sheet holds stays mounted while it is closed, keeping whatever was half done in it. */
  keepsContentMounted: boolean
  /** What the sheet holds, scrolling once it runs past the screen. */
  children: ReactNode
  /** What stays at the sheet's foot while the rest scrolls, null for nothing. */
  footer: ReactElement | null
}

/**
 * A sheet sliding down from the top of a phone or tablet screen over a dimmed page, on a frosted fill rounded at its
 * foot. A wide screen never shows it.
 */
export function TopSheet({
  isOpen,
  onClose,
  title,
  closeLabel,
  keepsContentMounted,
  children,
  footer,
}: TopSheetProps) {
  // Whether closing the sheet takes what it holds off the page
  const unmount = !keepsContentMounted

  // Focus handed back to wherever it was before the sheet opened, once a sheet that stays mounted closes
  useFocusReturn({ opened: isOpen, shouldReturnFocus: keepsContentMounted })

  return (
    <Transition show={isOpen} unmount={unmount}>
      <Dialog onClose={onClose} className="relative z-overlay lg:hidden" unmount={unmount}>
        {/* Backdrop */}
        <TransitionChild
          unmount={unmount}
          enter="transition-opacity ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <DialogBackdrop className="fixed inset-0 bg-background/30" />
        </TransitionChild>

        {/* Sheet */}
        <TransitionChild
          unmount={unmount}
          enter="transition-transform ease-out duration-300"
          enterFrom="-translate-y-full"
          enterTo="translate-y-0"
          leave="transition-transform ease-in duration-200"
          leaveFrom="translate-y-0"
          leaveTo="-translate-y-full"
        >
          <DialogPanel
            className={cn(
              'fixed inset-x-0 top-0 flex max-h-[100dvh] w-full flex-col',
              'rounded-b-2xl bg-surface/40 shadow-2xl backdrop-blur-xl'
            )}
          >
            {/* Header */}
            <div className="flex flex-shrink-0 items-center justify-between border-b border-foreground/10 px-6 py-4">
              <DialogTitle as="div">{title}</DialogTitle>
              <Button
                variant="ghost"
                onClick={onClose}
                aria-label={closeLabel}
                className="h-10 w-10 rounded-full bg-foreground/5 p-0 hover:bg-foreground/10"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>

            {/* Body */}
            <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

            {/* Footer */}
            {footer !== null && (
              <div className="flex-shrink-0 border-t border-foreground/10 px-6 py-4">{footer}</div>
            )}
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
