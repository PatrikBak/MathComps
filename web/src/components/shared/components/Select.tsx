'use client'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ComponentType } from 'react'

import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * One choice offered by a {@link Select}.
 */
type SelectOption = {
  /** What picking this choice yields. */
  value: string
  /** How the choice reads. */
  label: string
  /** Icon shown ahead of the label. */
  icon?: ComponentType<{ className?: string }>
}

/**
 * The props of {@link Select}.
 */
type SelectProps = {
  /** The choices on offer. */
  options: readonly SelectOption[]
  /** The value currently picked, or an empty string for none. */
  value: string
  /** Applies the value the user picked. */
  onChange: (value: string) => void
  /** What to show before anything is picked. */
  placeholder: string
  /** Extra classes for the trigger. */
  className?: string
}

/**
 * The house single-choice dropdown.
 */
export function Select({ options, value, onChange, placeholder, className }: SelectProps) {
  // The choice currently picked, if the value still names one
  const selectedOption = options.find((option) => option.value === value)

  // Render the trigger and the list of choices it opens
  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <>
          <ListboxButton
            className={cn(
              'w-full flex items-center justify-between gap-2 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-lg border border-muted/30 bg-surface/95 text-xs sm:text-sm text-muted-foreground outline-none transition-all hover:border-muted/60 focus:border-focus/60 focus:ring-2 focus:ring-focus/35',
              className
            )}
          >
            {/* Selected label, or the placeholder */}
            <span className="min-w-0 flex items-center gap-2 truncate">
              <TruncatedText className="text-foreground">
                {selectedOption?.label ?? placeholder}
              </TruncatedText>
            </span>

            {/* Open/closed indicator */}
            <span className="shrink-0 text-muted-foreground">
              {open ? (
                <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              )}
            </span>
          </ListboxButton>

          {/* Matched to the button's width, and capped at whatever the viewport allows */}
          <ListboxOptions
            anchor="bottom start"
            className="z-[1000] w-[var(--button-width)] max-h-[min(32vh,var(--anchor-max-height))] overflow-y-auto rounded-lg border border-foreground/10 bg-surface/95 p-0.5 sm:p-1 shadow-2xl backdrop-blur [--anchor-gap:8px]"
          >
            {options.map((option) => {
              // The choice's own icon, if it carries one
              const Icon = option.icon

              // The row for this choice
              return (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={({ selected, focus }) =>
                    cn(
                      'flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors cursor-pointer',
                      focus && 'bg-foreground/5',
                      selected && 'bg-focus/10 ring-1 ring-inset ring-focus/30'
                    )
                  }
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <TruncatedText className="truncate text-xs sm:text-sm font-medium text-foreground">
                      {option.label}
                    </TruncatedText>
                  </div>
                </ListboxOption>
              )
            })}
          </ListboxOptions>
        </>
      )}
    </Listbox>
  )
}
