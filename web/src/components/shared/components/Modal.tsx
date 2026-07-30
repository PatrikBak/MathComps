import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { X } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { cn } from '@/components/shared/utils/css-utils'
import { useOnClosed } from '@/hooks/use-on-closed'

/**
 * A surface's arrival: an exponential ease-out, which spends most of its travel in the first frames rather
 * than spreading it evenly across the duration. It runs as keyframes on mount, so the surface is up without
 * waiting on anything. Dismissal carries no animation at all: the reader who asked for it already knows
 * where it went.
 */
const ENTER_ANIMATION =
  'animate-in fade-in duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:animate-none'

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
  /**
   * Whether the panel fills the screen's height rather than hugging its content, laying its children out as a
   * column.
   */
  tall?: boolean
  /** Accessible name for the dialog when it renders its own header rather than a `title` */
  ariaLabel?: string
  /** Called once the modal is gone and the page is the reader's again */
  onClosed?: () => void
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
  tall = false,
  ariaLabel,
  onClosed,
}: ModalProps) {
  // Get translations for modal
  const tModal = useTranslations('ui.modal')

  // Hand the page back to whoever is waiting on it
  useOnClosed(isOpen, onClosed)

  return (
    <Dialog
      open={isOpen}
      as="div"
      aria-label={ariaLabel}
      className="relative z-50"
      onClose={onClose}
    >
      {/* Backdrop with blur */}
      <div className={cn('fixed inset-0 bg-background/50 backdrop-blur-sm', ENTER_ANIMATION)} />

      {/* Modal container */}
      <div className="fixed inset-0 overflow-y-auto">
        <div
          className={cn(
            'flex min-h-full justify-center text-center p-0 sm:p-4',
            align === 'center' ? 'items-center' : 'items-start sm:pt-16'
          )}
        >
          <DialogPanel
            className={cn(
              'w-full max-w-md transform overflow-hidden rounded-none sm:rounded-2xl bg-surface/95 backdrop-blur-sm border border-foreground/10 text-left align-middle shadow-xl',
              'zoom-in-95',
              ENTER_ANIMATION,
              padded && 'p-3 sm:p-6',
              tall && 'flex h-[100dvh] flex-col sm:h-[92vh] sm:max-w-4xl',
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
        </div>
      </div>
    </Dialog>
  )
}
