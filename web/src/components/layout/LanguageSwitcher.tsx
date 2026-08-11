'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { FlagIcon } from '@/components/features/guide/layout/FlagIcon'
import { DropdownMenuContent } from '@/components/shared/components/DropdownMenu'
import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'
import { useLanguageSwitcher } from '@/hooks/useLanguageSwitcher'
import { LOCALE_NAMES, LOCALE_TO_COUNTRY, SUPPORTED_LOCALES } from '@/i18n/i18n'

/**
 * Language switcher dropdown for the header.
 */
export function LanguageSwitcher() {
  // Get translations
  const t = useTranslations('common.language')

  // Track loading state while language is changing
  const [isChanging, setIsChanging] = useState(false)

  // Get the current locale and the function to change it
  const { currentLocale, changeLocale } = useLanguageSwitcher()

  // Reset loading state when locale changes (and this component re-renders)
  useEffect(() => {
    setIsChanging(false)
  }, [currentLocale])

  // Get the country flag data for the current locale
  const currentCountry = LOCALE_TO_COUNTRY[currentLocale]

  return (
    <DropdownMenu.Root modal={false}>
      {/* Trigger Button */}
      <DropdownMenu.Trigger
        id="language-switcher-trigger"
        className={cn(
          'flex items-center gap-1.5 px-2 py-1.5 rounded-lg outline-none',
          'text-sm font-medium text-foreground',
          'transition-all duration-300',
          'hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus',
          ACCENT_COLOR_MAP.indigo.hoverBg,
          ACCENT_COLOR_MAP.indigo.hoverGlow
        )}
        aria-label={t('change')}
      >
        {isChanging ? (
          <LoadingSpinner className="w-4 h-4 border" />
        ) : (
          <FlagIcon country={currentCountry} flagHeight={16} flagWidth={22} />
        )}
        <span className="uppercase text-xs tracking-wide">{currentLocale}</span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-muted transition-transform duration-200',
            'group-data-[state=open]:rotate-180'
          )}
          aria-hidden="true"
        />
      </DropdownMenu.Trigger>

      {/* Dropdown Content, its rows running the full width of the panel */}
      <DropdownMenuContent
        id="language-switcher-content"
        className="min-w-[140px] p-0 py-1.5"
        sideOffset={8}
        align="end"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {SUPPORTED_LOCALES.map((locale) => {
          // We will highlight the currently active locale
          const isActive = locale === currentLocale

          // Get the country flag data for the locale being rendered
          const country = LOCALE_TO_COUNTRY[locale]

          return (
            <DropdownMenu.Item
              key={locale}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-sm',
                'outline-none cursor-pointer transition-colors',
                isActive
                  ? 'bg-brand/20 text-foreground'
                  : 'text-muted-foreground hover:bg-surface/60 hover:text-foreground'
              )}
              onSelect={() => {
                if (locale !== currentLocale) {
                  setIsChanging(true)
                  changeLocale(locale)
                }
              }}
            >
              <FlagIcon country={country} flagHeight={14} flagWidth={20} />
              <span>{LOCALE_NAMES[locale]}</span>
              {isActive && <span className="ml-auto text-brand-light text-xs">✓</span>}
            </DropdownMenu.Item>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu.Root>
  )
}
