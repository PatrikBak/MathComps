'use client'

import { type ReactNode } from 'react'

import { LocalizedRouteProvider } from '@/hooks/useLocalizedRoute'

import { translateGuideSearchParams } from '../content/guide-url'

/**
 * Props for the {@link GuideRouteProvider} component.
 */
type GuideRouteProviderProps = {
  /** Child components */
  children: ReactNode
}

/**
 * Teaches the language switcher how to carry the guide deck's URL state across a locale change. The
 * deck's deep-link tokens are localized, so the switcher must re-encode the query for the target
 * locale rather than copy it verbatim; this client boundary hands it the guide's translator (a
 * function can't cross the server boundary as a page prop). Must wrap the navbar to reach the
 * switcher, so the page renders it above its layout.
 */
export function GuideRouteProvider({ children }: GuideRouteProviderProps) {
  // Expose the guide's query translator to the switcher via the localized-route context
  return (
    <LocalizedRouteProvider translateSearchParams={translateGuideSearchParams}>
      {children}
    </LocalizedRouteProvider>
  )
}
