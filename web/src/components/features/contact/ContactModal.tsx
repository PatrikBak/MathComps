'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { Modal } from '@/components/shared/components/Modal'

import ContactForm from './ContactForm'
import { type ContactFormData, type ReasonOption } from './contactFormSchema'

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
  defaultReason?: ReasonOption
}

export default function ContactModal({ isOpen, onClose, defaultReason }: ContactModalProps) {
  const tContact = useTranslations('contact')

  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFormSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || tContact('sendFailed'))
      }

      toast.success(tContact('successMessage'))
      onClose()
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(error instanceof Error ? error.message : tContact('sendFailedRetry'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tContact('title')} showCloseButton>
      <ContactForm
        defaultReason={defaultReason}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </Modal>
  )
}
