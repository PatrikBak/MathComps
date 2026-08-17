'use client'

import { useDisclosure } from '@mantine/hooks'
import { Bot } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { Modal } from '@/components/shared/components/Modal'
import { MATHILDA_NAME } from '@/constants/mathilda'

import type { DefenseProblem } from '../model/defense-types'
import { DefenseConversation } from './DefenseConversation'
import { MathildaWordmark } from './MathildaWordmark'

/**
 * Props for the {@link DefenseChatTrigger}.
 */
type DefenseChatTriggerProps = {
  /** The problem being defended, including its reference solution. */
  problem: DefenseProblem
}

/**
 * The per-problem entry point to the defense chat: a named button on the problem card that opens the
 * {@link DefenseConversation} in a modal. Shown to every visitor; a signed-out one reads the opener with a
 * sign-in prompt where the composer would be.
 */
export function DefenseChatTrigger({ problem }: DefenseChatTriggerProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

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

  return (
    <>
      {/* Opens the defense for this problem */}
      <Button
        variant="outline"
        size="sm"
        shape="pill"
        onClick={handleOpen}
        aria-label={MATHILDA_NAME}
      >
        <Bot size={16} strokeWidth={1.75} />
        <span>
          <MathildaWordmark />
        </span>
      </Button>

      {/* The defense chat itself */}
      {hasOpened && (
        <Modal
          isOpen={isOpen}
          onClose={close}
          showCloseButton={false}
          padded={false}
          ariaLabel={t('title')}
          tall
        >
          <DefenseConversation
            problem={problem}
            isOpen={isOpen}
            onClose={close}
            mode={{ kind: 'fromProblem' }}
          />
        </Modal>
      )}
    </>
  )
}
