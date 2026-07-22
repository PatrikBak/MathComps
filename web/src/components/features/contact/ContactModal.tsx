'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Modal } from '@/components/shared/components/Modal'
import { readErrorCode } from '@/lib/api/api-error-codes'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'

import { type ReasonOption } from './contact-reasons'
import { type ContactFormData } from './contact-schema'
import ContactForm from './ContactForm'

/**
 * Props for {@link ContactModal}.
 */
type ContactModalProps = {
  /** Whether the modal is open */
  isOpen: boolean
  /** Closes the modal */
  onClose: () => void
  /** Reason to pre-select in the form */
  defaultReason?: ReasonOption
}

/**
 * The contact form in a modal, owning the submission and its result feedback.
 */
export default function ContactModal({ isOpen, onClose, defaultReason }: ContactModalProps) {
  // Translator for the modal title and feedback copy
  const tContact = useTranslations('contact')

  // Central failure-code copy
  const tApiErrors = useTranslations('apiErrors')

  // Submit a validated payload and report the outcome
  const handleFormSubmit = async (data: ContactFormData) => {
    // Try the request, surfacing a failure as a toast
    try {
      // POST the form data to the contact endpoint
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      // A server-side failure
      if (!response.ok) {
        // Read the route's error code
        const errorCode = await readErrorCode(response)

        // Toast its localized copy
        toast.error(
          resolveErrorMessage(errorCode, tApiErrors, { fallback: tContact('sendFailed') })
        )

        // Leave the modal open so they can retry
        return
      }

      // Tell the user it worked
      toast.success(tContact('successMessage'))

      // Close the modal
      onClose()
    } catch {
      // A thrown fetch/parse error (e.g. offline)
      toast.error(tContact('sendFailedRetry'))
    }
  }

  // Render the form inside the modal shell
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tContact('title')} showCloseButton>
      <ContactForm defaultReason={defaultReason} onSubmit={handleFormSubmit} />
    </Modal>
  )
}
