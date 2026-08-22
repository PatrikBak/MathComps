'use client'

import { useDisclosure } from '@mantine/hooks'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Suspense, useState } from 'react'

import { Modal } from '@/components/shared/components/Modal'

import { type ReasonOption } from './contact-reasons'

/**
 * The contact form, loaded on demand: it brings a schema validator and a form library, and most
 * visits never open it.
 */
const ContactModal = dynamic(() => import('./ContactModal'))

/**
 * Props for {@link ContactModalPlaceholder}.
 */
type ContactModalPlaceholderProps = {
  /** Dismisses the placeholder */
  onClose: () => void
}

/**
 * Stands in for the form while its chunk downloads, so the click that opened it lands on something.
 *
 * Its caller renders it only while the modal is meant to be open, which is why it can hardcode
 * `isOpen`.
 */
function ContactModalPlaceholder({ onClose }: ContactModalPlaceholderProps) {
  // Contact-surface copy
  const tContact = useTranslations('contact')

  // Cross-surface waiting copy
  const tCommon = useTranslations('common')

  return (
    <Modal isOpen onClose={onClose} title={tContact('title')} showCloseButton>
      <p className="py-8 text-center text-sm text-muted">{tCommon('loading')}</p>
    </Modal>
  )
}

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

  // Whether the form has ever been opened
  const [hasOpenedModal, setHasOpenedModal] = useState(false)

  // Opens the form, mounting it on the first open
  const handleOpen = () => {
    // Mount the form
    setHasOpenedModal(true)

    // Show it
    openModal()
  }

  // Render the trigger and the modal it controls
  return (
    <>
      <button onClick={handleOpen} className={className}>
        {children}
      </button>

      {hasOpenedModal && (
        <Suspense fallback={isModalOpen ? <ContactModalPlaceholder onClose={closeModal} /> : null}>
          <ContactModal isOpen={isModalOpen} onClose={closeModal} defaultReason={reason} />
        </Suspense>
      )}
    </>
  )
}
