'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'

import type { AddressedDisclosure } from '@/hooks/use-addressed-disclosure'
import { useAddressedDisclosure } from '@/hooks/use-addressed-disclosure'
import { useLoginPromptToast } from '@/hooks/use-login-prompt-toast'

import { FEEDBACK_PARAM } from '../services/hosted-competition-routes'

/**
 * Which problem's conversation with the graders is open, carried in the address under {@link FEEDBACK_PARAM}.
 *
 * Only a signed-in student has a thread to open, so a reader known to be signed out whose address names one is
 * asked to sign in, once per page view. Signing in comes back to the address as it stands, which still names the
 * thread, so it opens then.
 *
 * @param isSignedOut - Whether the reader is known to be signed out; false while that is still unsettled.
 *
 * @returns Which thread is open, and the two ways to change it.
 */
export function useFeedbackDisclosure(isSignedOut: boolean): AddressedDisclosure {
  // Competitions copy
  const t = useTranslations('competitions')

  // Which thread is open, as the address names it
  const disclosure = useAddressedDisclosure(FEEDBACK_PARAM)

  // The shared sign-in prompt
  const showLoginPrompt = useLoginPromptToast()

  // Whether the reader has been asked to sign in on this page view
  const hasPromptedRef = useRef(false)

  // The thread the address names; null where it names none
  const requestedValue = disclosure.openedValue

  // A signed-out reader sent to a thread, asked to sign in
  useEffect(() => {
    // Asked once, and only once nobody is signed in and the address names a thread to come back to
    if (
      hasPromptedRef.current ||
      !isSignedOut ||
      requestedValue === null ||
      requestedValue === ''
    ) {
      return
    }

    // Asked from now on
    hasPromptedRef.current = true

    // The prompt, whose sign-in comes back to the address as it stands
    showLoginPrompt({ reason: t('feedbackAuthReason') })
  }, [isSignedOut, requestedValue, showLoginPrompt, t])

  // Which thread is open, and the two ways to change it
  return disclosure
}
