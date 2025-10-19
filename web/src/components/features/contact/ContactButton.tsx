'use client'

import { useState } from 'react'

import { type ReasonOption } from './contactFormSchema'
import ContactModal from './ContactModal'

interface ContactButtonProps {
  reason?: ReasonOption
  children: React.ReactNode
  className?: string
}

export default function ContactButton({ reason, children, className }: ContactButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const openModal = () => setIsModalOpen(true)
  const closeModal = () => setIsModalOpen(false)

  return (
    <>
      <button onClick={openModal} className={className}>
        {children}
      </button>

      <ContactModal isOpen={isModalOpen} onClose={closeModal} defaultReason={reason} />
    </>
  )
}
