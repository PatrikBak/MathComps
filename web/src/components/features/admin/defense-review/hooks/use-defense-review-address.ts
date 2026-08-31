'use client'

import { useCallbackRef } from '@mantine/hooks'
import { useEffect, useRef, useTransition } from 'react'

import { ROUTES } from '@/i18n/i18n'
import { useRouter } from '@/i18n/navigation'

import { type DefenseReviewUrlState, toDefenseReviewQuery } from '../model/defense-review-url'

/**
 * Keeps the address bar saying what the queue is showing.
 *
 * The address is the record rather than the source: a narrowing shows the moment it is clicked, and the routed
 * navigation catches up behind it. Which makes a reload land back where the reader was, and makes a conversation
 * something they can send to somebody else.
 *
 * Every write replaces rather than pushes. Walking a queue produces an address per conversation, and a back
 * button that had to be pressed forty times to leave the page would be worse than no history at all.
 *
 * @param state - What the queue is showing.
 */
export function useDefenseReviewAddressSync(state: DefenseReviewUrlState): void {
  // The localized router, which puts the reader's language back on the front of the route
  const router = useRouter()

  // Rewriting the address is background work, so it never holds up the click that caused it
  const [, startTransition] = useTransition()

  // What the address the page loaded on already says, canonicalized, so an unchanged queue doesn't navigate
  // over and over, and so that the first say, which is always the address the reader is already looking at,
  // isn't a navigation back into the route and its admin gate for no change at all
  const publishedRef = useRef<string | null>(toDefenseReviewQuery(state))

  // Writes the queue back into the address
  const publish = useCallbackRef(() => {
    // What the address should now say
    const query = toDefenseReviewQuery(state)

    // Saying it already means there is nothing to do
    if (query === publishedRef.current) return

    // What the address now stands at
    publishedRef.current = query

    // Behind whatever the click was, since the reader is already looking at the result
    startTransition(() => {
      router.replace(query === '' ? ROUTES.ADMIN_DEFENSES : `${ROUTES.ADMIN_DEFENSES}?${query}`, {
        scroll: false,
      })
    })
  })

  // Say what is on screen, every time it changes
  useEffect(() => publish(), [publish, state.filter, state.openId])
}
