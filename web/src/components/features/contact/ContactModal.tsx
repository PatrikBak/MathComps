'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Modal } from '@/components/shared/components/Modal'
import { resolveErrorMessage } from '@/lib/api/api-error-utils'
import { fetchApiResult } from '@/lib/api/api-fetch'

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
    // POST the form data to the contact endpoint
    const result = await fetchApiResult('/api/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    })

    // A failed send
    if (!result.success) {
      // A failure carrying no status never reached the server, which is the offline case
      const fallback =
        result.error.statusCode === undefined ? tContact('sendFailedRetry') : tContact('sendFailed')

      // Toast the failure's localized copy
      toast.error(resolveErrorMessage(result.error.errorCode, tApiErrors, { fallback }))

      // Leave the modal open so they can retry
      return
    }

    // Tell the user it worked
    toast.success(tContact('successMessage'))

    // Close the modal
    onClose()
  }

  // Render the form inside the modal shell
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tContact('title')} showCloseButton>
      <ContactForm defaultReason={defaultReason} onSubmit={handleFormSubmit} />
    </Modal>
  )
}
