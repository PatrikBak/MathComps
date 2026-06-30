'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'

import { Modal } from '@/components/shared/components/Modal'

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

  // Submit a validated payload and report the outcome
  const handleFormSubmit = async (data: ContactFormData) => {
    // Try the request, surfacing a server error as a throw
    try {
      // POST the form data to the contact endpoint
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      // Read the JSON body (success or error payload)
      const result = await response.json()

      // Surface a server-side failure as a thrown error
      if (!response.ok) {
        throw new Error(result.error || tContact('sendFailed'))
      }

      // Tell the user it worked
      toast.success(tContact('successMessage'))
      // Close the modal
      onClose()
    } catch (error) {
      // Show it to the user
      toast.error(error instanceof Error ? error.message : tContact('sendFailedRetry'))
    }
  }

  // Render the form inside the modal shell
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tContact('title')} showCloseButton>
      <ContactForm defaultReason={defaultReason} onSubmit={handleFormSubmit} />
    </Modal>
  )
}
