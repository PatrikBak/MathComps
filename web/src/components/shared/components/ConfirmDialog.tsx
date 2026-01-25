import { AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Modal } from '@/components/shared/components/Modal'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ConfirmDialog} component.
 */
type ConfirmDialogProps = {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Called when dialog should close (cancel or backdrop click) */
  onClose: () => void
  /** Called when user confirms the action */
  onConfirm: () => void | Promise<void>
  /** Dialog title */
  title: string
  /** Dialog message/description */
  message: string
  /** Text for confirm button */
  confirmText?: string
  /** Text for cancel button */
  cancelText?: string
  /** Variant affects confirm button color */
  variant?: 'danger' | 'warning' | 'default'
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
  variant = 'danger',
}: ConfirmDialogProps) {
  // Get translations
  const tActions = useTranslations('ui.actions')

  // Whether the confirm action is currently loading
  const [isLoading, setIsLoading] = useState(false)

  // Use translated defaults if not provided
  const resolvedConfirmText = confirmText ?? tActions('confirm')
  const resolvedCancelText = cancelText ?? tActions('cancel')

  /** Called when we are confirming the action with the main button */
  const handleConfirm = async () => {
    try {
      // Call the confirm action
      const result = onConfirm()

      // If it returns a promise, wait for it to resolve
      if (result instanceof Promise) {
        // Set that we're waiting
        setIsLoading(true)

        // And wait for the promise to resolve
        await result
      }

      // After the action is done, close the dialog
      onClose()
    } finally {
      // Regardless of success or failure, reset the loading state
      setIsLoading(false)
    }
  }

  /** Called when we are closing the dialog */
  const handleClose = () => {
    // Prevent the dialog from closing if we're loading
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-sm" showCloseButton={false}>
      {/* Icon + Title */}
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full',
            variant === 'danger' && 'bg-red-500/20 text-red-400',
            variant === 'warning' && 'bg-yellow-500/20 text-yellow-400',
            variant === 'default' && 'bg-slate-500/20 text-slate-400'
          )}
        >
          <AlertTriangle size={20} />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>

      {/* Message */}
      <p className="text-sm text-gray-400 mb-5 ml-[52px]">{message}</p>

      {/* Buttons */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-300 bg-slate-700/50 hover:bg-slate-600/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resolvedCancelText}
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isLoading}
          className={cn(
            'relative px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed',
            variant === 'danger' && 'bg-red-600 hover:bg-red-500 text-white',
            variant === 'warning' && 'bg-yellow-600 hover:bg-yellow-500 text-white',
            variant === 'default' && 'bg-indigo-600 hover:bg-indigo-500 text-white'
          )}
        >
          <span className={cn(isLoading ? 'invisible' : '')}>{resolvedConfirmText}</span>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </button>
      </div>
    </Modal>
  )
}
