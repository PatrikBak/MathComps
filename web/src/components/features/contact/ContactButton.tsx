'use client'

import { useDisclosure } from '@mantine/hooks'

import { type ReasonOption } from './contact-reasons'
import ContactModal from './ContactModal'

/**
 * Props for {@link ContactButton}.
 */
type ContactButtonProps = {
  /** Reason to pre-select when the modal opens */
  reason?: ReasonOption
  /** The button's visible content */
  children: React.ReactNode
  /** Class names for the trigger button */
  className?: string
}

/**
 * A trigger that opens the contact modal, optionally pre-selecting a reason.
 */
export default function ContactButton({ reason, children, className }: ContactButtonProps) {
  // Modal open-state plus its open/close handlers
  const [isModalOpen, { open: openModal, close: closeModal }] = useDisclosure(false)

  // Render the trigger and the modal it controls
  return (
    <>
      <button onClick={openModal} className={className}>
        {children}
      </button>

      <ContactModal isOpen={isModalOpen} onClose={closeModal} defaultReason={reason} />
    </>
  )
}
