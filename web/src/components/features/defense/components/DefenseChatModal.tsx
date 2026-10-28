'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Modal } from '@/components/shared/components/Modal'

import type { DefenseProblem } from '../model/defense-types'
import { DefenseConversation } from './DefenseConversation'

/**
 * Props for the {@link DefenseChatModal}.
 */
type DefenseChatModalProps = {
  /** The problem being defended. */
  problem: DefenseProblem
  /** Whether the chat is open. */
  isOpen: boolean
  /** Closes the chat. */
  onClose: () => void
}

/**
 * The defense chat about one problem, in a modal opening on the newest conversation. The modal mounts on its first
 * open and stays mounted after. The conversation inside it mounts each time the modal opens.
 */
export function DefenseChatModal({ problem, isOpen, onClose }: DefenseChatModalProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Whether the chat has ever been opened
  const [hasOpened, setHasOpened] = useState(false)

  // Keep the modal mounted from its first open
  if (isOpen && !hasOpened) setHasOpened(true)

  // Nothing until the chat first opens
  if (!hasOpened) return null

  // The chat's modal, open or closed
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      padded={false}
      ariaLabel={t('title')}
      tall
    >
      <DefenseConversation
        problem={problem}
        onClose={onClose}
        opening={{ kind: 'newest' }}
        entry={null}
      />
    </Modal>
  )
}
