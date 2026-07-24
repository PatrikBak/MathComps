import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'

import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

/** How grave the confirmed action is. */
type ConfirmVariant = 'danger' | 'warning' | 'default'

/**
 * The variant-dependent styling of one dialog.
 */
type ConfirmVariantStyle = {
  /** Classes for the disc behind the icon. */
  icon: string
  /** Classes for the confirm button. */
  confirmButton: string
}

/** The icon and confirm-button styling for each variant. */
const VARIANT_STYLES: Record<ConfirmVariant, ConfirmVariantStyle> = {
  danger: {
    icon: 'bg-error/20 text-error',
    confirmButton: 'bg-error hover:bg-error/90 text-error-foreground',
  },
  warning: {
    icon: 'bg-warning/20 text-warning',
    confirmButton: 'bg-warning hover:bg-warning/90 text-warning-foreground',
  },
  default: {
    icon: 'bg-focus/20 text-focus',
    confirmButton: 'bg-brand hover:bg-brand-hover text-brand-foreground',
  },
}

/**
 * Props for the {@link ConfirmDialog} component.
 */
type ConfirmDialogProps = {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Called when dialog should close (cancel or backdrop click) */
  onClose: () => void
  /** Called when user confirms the action; it reports its own failure */
  onConfirm: () => void | Promise<void>
  /** Dialog title */
  title: string
  /** Dialog message/description */
  message: string
  /** Text for confirm button */
  confirmText?: string
  /** Text for cancel button */
  cancelText?: string
  /** How grave the confirmed action is, which the icon and confirm button take their colour from */
  variant: ConfirmVariant
}

/**
 * A confirmation dialog component built on top of the {@link Modal} component.
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant,
}: ConfirmDialogProps) {
  // Get translations
  const tActions = useTranslations('ui.actions')

  // The icon and confirm-button styling this dialog wears
  const style = VARIANT_STYLES[variant]

  // Use translated defaults if not provided
  const resolvedConfirmText = confirmText ?? tActions('confirm')
  const resolvedCancelText = cancelText ?? tActions('cancel')

  /** Called when we are confirming the action with the main button */
  const handleConfirm = () => {
    // Dismiss on the answer, not on the action landing
    onClose()

    // Run the confirmed action
    void onConfirm()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-sm" showCloseButton={false}>
      {/* Icon + Title */}
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('flex items-center justify-center w-10 h-10 rounded-full', style.icon)}>
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      </div>

      {/* Message */}
      <p className="text-sm text-muted mb-5 ml-[52px]">{message}</p>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-muted-foreground bg-foreground/5 hover:bg-foreground/10 rounded-lg transition-colors"
        >
          {resolvedCancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          className={cn(
            'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
            style.confirmButton
          )}
        >
          {resolvedConfirmText}
        </button>
      </div>
    </Modal>
  )
}
