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
 * Mobile-friendly language switcher showing inline buttons for each locale.
 * Designed for use inside the mobile navigation drawer.
 */
export function MobileLanguageSwitcher({ onSelect }: MobileLanguageSwitcherProps) {
  // The currently active locale
  const { currentLocale, changeLocale } = useLanguageSwitcher()

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {SUPPORTED_LOCALES.map((locale) => {
        // We will highlight the currently active locale
        const isActive = locale === currentLocale

        // The country flag data for the locale being rendered
        const country = LOCALE_TO_COUNTRY[locale]

        return (
          <button
            key={locale}
            type="button"
            onClick={() => changeLocale(locale, onSelect)}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg',
              'text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-focus/25 text-focus-foreground border border-focus/40'
                : 'bg-foreground/5 text-muted-foreground border border-transparent hover:bg-foreground/10 hover:text-foreground'
            )}
            aria-pressed={isActive}
          >
            <FlagIcon country={country} flagHeight={14} flagWidth={20} />
            <span>{LOCALE_NAMES[locale]}</span>
          </button>
        )
      })}
    </div>
  )
}
