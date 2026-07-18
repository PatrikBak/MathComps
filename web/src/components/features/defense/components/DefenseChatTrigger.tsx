'use client'

import { useDisclosure } from '@mantine/hooks'
import { MessagesSquare } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { useIsAdmin } from '@/hooks/use-is-admin'

import type { DefenseProblem } from '../model/defense-types'
import { DefenseModal } from './DefenseModal'

/**
 * Props for the {@link DefenseChatTrigger}.
 */
type DefenseChatTriggerProps = {
  /** The problem being defended, including its reference solution. */
  problem: DefenseProblem
}

/**
 * The per-problem entry point to the defense chat: a small icon on the problem card that opens the
 * {@link DefenseModal}. Admin-gated on the client only, a visibility gate rather than a real access
 * boundary.
 */
export function DefenseChatTrigger({ problem }: DefenseChatTriggerProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Whether the viewer is an admin
  const isAdmin = useIsAdmin()

  // Modal open state
  const [isOpen, { open, close }] = useDisclosure(false)

  // Whether the modal has ever been opened; it lazy-mounts on first open and stays mounted after
  const [hasOpened, setHasOpened] = useState(false)

  // Opens the defense, mounting the modal on the first open
  const handleOpen = () => {
    // The modal exists from here on
    setHasOpened(true)

    // Show it
    open()
  }

  // Non-admins never see the trigger, even if it somehow reached the client
  if (!isAdmin) {
    return null
  }

  return (
    <>
      {/* Opens the defense for this problem */}
      <Button variant="ghost" size="icon" onClick={handleOpen} aria-label={t('title')}>
        <MessagesSquare size={16} />
      </Button>

      {/* The defense chat itself */}
      {hasOpened && <DefenseModal problem={problem} isOpen={isOpen} onClose={close} />}
    </>
  )
}
