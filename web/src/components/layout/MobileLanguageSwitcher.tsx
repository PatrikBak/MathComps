'use client'

import { FlagIcon } from '@/components/features/guide/layout/FlagIcon'
import { cn } from '@/components/shared/utils/css-utils'
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher'
import { LOCALE_NAMES, LOCALE_TO_COUNTRY, SUPPORTED_LOCALES } from '@/i18n/i18n'

/**
 * Props for the {@link MobileLanguageSwitcher} component.
 */
type MobileLanguageSwitcherProps = {
  /** Callback called after selecting a language (e.g., to close the drawer) */
  onSelect: () => void
}

/**
 * Mobile-friendly language switcher rendered as a compact segmented control.
 */
export function MobileLanguageSwitcher({ onSelect }: MobileLanguageSwitcherProps) {
  // The currently active locale
  const { currentLocale, changeLocale } = useLanguageSwitcher()

  return (
    <div className="self-start inline-flex items-stretch rounded-xl bg-foreground/5 border border-foreground/5 p-1 gap-0.5">
      {SUPPORTED_LOCALES.map((locale) => {
        // Determine whether this locale is the active one
        const isActive = locale === currentLocale

        // The country flag data for the locale being rendered
        const country = LOCALE_TO_COUNTRY[locale]

        return (
          <button
            key={locale}
            type="button"
            onClick={() => changeLocale(locale, onSelect)}
            className={cn(
              'flex items-center justify-center gap-2 px-4 py-2 rounded-lg',
              'text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
              isActive
                ? 'bg-foreground/10 text-foreground font-semibold'
                : 'text-muted-foreground font-medium hover:text-foreground'
            )}
            aria-pressed={isActive}
            aria-label={LOCALE_NAMES[locale]}
          >
            <FlagIcon country={country} flagHeight={13} flagWidth={18} />
            <span>{LOCALE_TO_COUNTRY[locale]}</span>
          </button>
        )
      })}
    </div>
  )
}
