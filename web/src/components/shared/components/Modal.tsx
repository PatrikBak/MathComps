import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Fragment } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link Modal} component.
 */
type ModalProps = {
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Optional title displayed in the header */
  title?: React.ReactNode
  /** Modal content */
  children: React.ReactNode
  /** Whether to show the close button in header */
  showCloseButton: boolean
  /** Additional className for the panel */
  className?: string
  /** Vertical alignment: 'center' (default) or 'top' (prevents layout shifts) */
  align?: 'center' | 'top'
  /** Whether the panel carries its own inner padding; false lets content own its layout edge-to-edge */
  padded?: boolean
  /** Accessible name for the dialog when it renders its own header rather than a `title` */
  ariaLabel?: string
}

/**
 * Reusable modal component with consistent styling. Uses @headlessui/react Dialog.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  showCloseButton,
  className,
  align = 'center',
  padded = true,
  ariaLabel,
}: ModalProps) {
  // Get translations for modal
  const tModal = useTranslations('ui.modal')

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" aria-label={ariaLabel} className="relative z-50" onClose={onClose}>
        {/* Backdrop with blur */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-background/50 backdrop-blur-sm" />
        </TransitionChild>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div
            className={cn(
              'flex min-h-full justify-center text-center p-0 sm:p-4',
              align === 'center' ? 'items-center' : 'items-start sm:pt-16'
            )}
          >
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel
                className={cn(
                  'w-full max-w-md transform overflow-hidden rounded-none sm:rounded-2xl bg-surface/95 backdrop-blur-sm border border-foreground/10 text-left align-middle shadow-xl transition-all',
                  padded && 'p-3 sm:p-6',
                  className
                )}
              >
                {/* Optional header with title and close button */}
                {(title || showCloseButton) && (
                  <div className="flex items-start justify-between gap-4 mb-3 sm:mb-6">
                    {title && (
                      <DialogTitle
                        as="h3"
                        className="text-xl font-bold text-foreground flex items-start gap-2 min-w-0"
                      >
                        {title}
                      </DialogTitle>
                    )}
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        className="text-muted hover:text-foreground transition-colors duration-200 ml-auto flex-shrink-0"
                        aria-label={tModal('close')}
                      >
                        <X size={24} />
                      </button>
                    )}
                  </div>
                )}

                {/* Content */}
                {children}
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
