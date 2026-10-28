'use client'

import { useDisclosure } from '@mantine/hooks'
import { Bot } from 'lucide-react'

import { Button } from '@/components/shared/components/Button'
import { MATHILDA_NAME } from '@/constants/mathilda'

import { useDefenseCopy } from '../hooks/use-defense-copy'
import type { DefenseProblem } from '../model/defense-types'
import { DefenseChatModal } from './DefenseChatModal'
import { MathildaWordmark } from './MathildaWordmark'

/**
 * Props for the {@link DefenseChatTrigger}.
 */
type DefenseChatTriggerProps = {
  /** The problem being defended. */
  problem: DefenseProblem
}

/**
 * The per-problem entry point to the defense chat: a named button on the problem card that opens the
 * {@link DefenseChatModal}. Shown to every visitor; a signed-out one reads the opener with a sign-in prompt where the
 * composer would be.
 */
export function DefenseChatTrigger({ problem }: DefenseChatTriggerProps) {
  // Warmed while the page paints, so the greeting is cached by the time anybody opens the chat. Every
  // trigger on the page asks for the same one, which is one request between them
  useDefenseCopy()

  // Whether the chat is open, and the ways to open and close it
  const [isOpen, { open, close }] = useDisclosure(false)

  return (
    <>
      {/* Opens the defense for this problem */}
      <Button variant="outline" size="sm" shape="pill" onClick={open} aria-label={MATHILDA_NAME}>
        <Bot size={16} strokeWidth={1.75} />
        <span>
          <MathildaWordmark />
        </span>
      </Button>

      {/* The defense chat itself */}
      <DefenseChatModal problem={problem} isOpen={isOpen} onClose={close} />
    </>
  )
}
