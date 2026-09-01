'use client'

import { type ReactNode } from 'react'

import { LocalizedRouteProvider } from '@/hooks/useLocalizedRoute'

import { useEntryReader } from '../hooks/use-entry-reader'
import { useHostedCompetitionsView } from '../hooks/use-hosted-competitions-view'
import { findCompetitionInGroup } from '../model/hosted-competition-state'

/**
 * Props for the {@link CompetitionRouteProvider} component.
 */
type CompetitionRouteProviderProps = {
  /** Which competition the reader is inside. */
  competitionSlug: string
  /** Child components */
  children: ReactNode
}

/**
 * Tells the language switcher what the other languages call this competition, so a switch can land on the name
 * the reader is going to. The names arrive on the same list the area reads, so a client boundary is what
 * fetches them. Must wrap the navbar to reach the switcher, so the page renders it above its layout.
 */
export function CompetitionRouteProvider({
  competitionSlug,
  children,
}: CompetitionRouteProviderProps) {
  // Who is reading, and whether that is settled yet
  const { readerKey, isReaderKnown } = useEntryReader()

  // Every competition the reader can see, this one among them
  const { view } = useHostedCompetitionsView(readerKey, isReaderKnown)

  // What each language calls this one, absent until that read lands
  const slugTranslations = findCompetitionInGroup(view, competitionSlug)?.competition.slug

  // Expose the competition's names to the switcher via the localized-route context
  return (
    <LocalizedRouteProvider slugTranslations={slugTranslations}>{children}</LocalizedRouteProvider>
  )
}
