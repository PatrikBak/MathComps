'use client'

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
        throw new Error(result.error || 'Správu sa nepodarilo odoslať')
      }

      toast.success('Správa úspešne poslaná! Čoskoro sa vám ozveme.')
      onClose()
    } catch (error) {
      console.error('Contact form error:', error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Správu sa nepodarilo odoslať. Skúste znova neskôr.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Napíšte nám" showCloseButton>
      <ContactForm
        defaultReason={defaultReason}
        onSubmit={handleFormSubmit}
        isSubmitting={isSubmitting}
      />
    </Modal>
  )
}
