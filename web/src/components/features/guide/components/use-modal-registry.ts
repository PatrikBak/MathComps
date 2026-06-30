import { useCounter } from '@mantine/hooks'
import { useCallback } from 'react'

/**
 * A registry of open card modals, tracking whether any card modal is currently up.
 */
export type ModalRegistry = {
  /** Mark a card modal as open; returns a deregister to call when it closes. */
  registerOpenModal: () => () => void
  /** Whether any registered card modal is currently open. */
  anyModalOpen: boolean
}

/**
 * A hook that counts the card modals currently open. A card registers as it opens and calls the
 * returned deregister as it closes (or unmounts).
 *
 * @returns The register function and whether any modal is open.
 */
export function useModalRegistry(): ModalRegistry {
  // The live count of open card modals (the handlers are stable, so a registrar built on them is too)
  const [openCount, { increment, decrement }] = useCounter(0)

  // Register an open modal, handing back the matching deregister
  const registerOpenModal = useCallback(() => {
    // Count this modal in
    increment()
    // Count it back out on close
    return () => decrement()
  }, [increment, decrement])

  // Hand back the registrar plus whether anything is open
  return { registerOpenModal, anyModalOpen: openCount > 0 }
}
