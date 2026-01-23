'use client'

import { createContext, type ReactNode, useContext } from 'react'

import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * The value of the {@link LocalizedRouteContext}.
 */
type LocalizedRouteContextValue = {
  /** Map of locale to slug for the current content item */
  slugTranslations: LocalizedString
}

/**
 * Context for pages with localized dynamic route segments (e.g., handouts).
 * Provides slug translations so the language switcher can navigate to the correct
 * localized URL when changing languages.
 */
const LocalizedRouteContext = createContext<LocalizedRouteContextValue | null>(null)

/**
 * Hook to access slug translations for the current page.
 * Returns null if the current page doesn't have localized slugs.
 */
export function useLocalizedRoute(): LocalizedRouteContextValue | null {
  return useContext(LocalizedRouteContext)
}

/**
 * Gets the translated slug for a target locale.
 * Falls back to the current slug if no translation is available.
 *
 * @param currentSlug - The current slug in the URL
 * @param targetLocale - The locale to get the slug for
 * @param translations - The slug translations map (or null if not available)
 */
export function getTranslatedSlug(
  currentSlug: string,
  targetLocale: Locale,
  translations: LocalizedString | null
): string {
  return translations?.[targetLocale] ?? currentSlug
}

/**
 * Props for the LocalizedRouteProvider component.
 */
type LocalizedRouteProviderProps = {
  /** Slug translations for the current content item */
  slugTranslations: LocalizedString
  /** Child components */
  children: ReactNode
}

/**
 * Provider component for pages with localized dynamic routes.
 * Wrap your page content with this to enable proper language switching.
 */
export function LocalizedRouteProvider({
  slugTranslations,
  children,
}: LocalizedRouteProviderProps) {
  return (
    <LocalizedRouteContext.Provider value={{ slugTranslations }}>
      {children}
    </LocalizedRouteContext.Provider>
  )
}
