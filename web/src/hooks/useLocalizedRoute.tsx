'use client'

import { createContext, type ReactNode, useContext } from 'react'

import type { Locale, LocalizedString } from '@/i18n/i18n'

/**
 * The value of the {@link LocalizedRouteContext}. A route supplies whichever locale-specific URL
 * parts it owns: a slug map (dynamic path segment) and/or a query-string translator.
 */
type LocalizedRouteContextValue = {
  /** Map of locale to slug for the current content item */
  slugTranslations?: LocalizedString
  /** Re-expresses the query string from one locale's vocabulary into another's */
  translateSearchParams?: (params: URLSearchParams, from: Locale, to: Locale) => string
}

/**
 * Context for pages with localized dynamic route segments (e.g., handouts), so switching language
 * can navigate to the correct localized URL.
 */
const LocalizedRouteContext = createContext<LocalizedRouteContextValue | null>(null)

/**
 * Hook to access the current page's localized-route context.
 * Returns null when the page has no localized routing.
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
 *
 * @returns The target locale's slug, or the current slug when no translation exists
 */
export function getTranslatedSlug(
  currentSlug: string,
  targetLocale: Locale,
  translations: LocalizedString | null
): string {
  return translations?.[targetLocale] ?? currentSlug
}

/**
 * Props for the {@link LocalizedRouteProvider} component.
 */
type LocalizedRouteProviderProps = {
  /** Slug translations for the current content item */
  slugTranslations?: LocalizedString
  /** Re-expresses the query string from one locale's vocabulary into another's */
  translateSearchParams?: (params: URLSearchParams, from: Locale, to: Locale) => string
  /** Child components */
  children: ReactNode
}

/**
 * Provider component for pages with localized dynamic routes.
 * Wrap your page content with this to enable proper language switching.
 */
export function LocalizedRouteProvider({
  slugTranslations,
  translateSearchParams,
  children,
}: LocalizedRouteProviderProps) {
  // Provide this route's localized URL parts to the subtree
  return (
    <LocalizedRouteContext value={{ slugTranslations, translateSearchParams }}>
      {children}
    </LocalizedRouteContext>
  )
}
