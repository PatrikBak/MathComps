'use client'

import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import type { ComponentType } from 'react'

import {
  getSelectOptionClassName,
  SELECT_OPTION_LABEL_CLASS_NAME,
  SELECT_PANEL_CLASS_NAME,
  SELECT_PLACEHOLDER_CLASS_NAME,
  SelectChevron,
} from '@/components/shared/components/select/select-parts'
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
  // The choice currently picked. An empty value is nothing picked even when a choice carries it, so a list can
  // offer clearing itself as a row while the placeholder still reads as the placeholder
  const selectedOption = value === '' ? undefined : options.find((option) => option.value === value)

  // Render the trigger and the list of choices it opens
  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <>
          {/* A button dressed as a text input */}
          <ListboxButton
            className={cn(
              'form-input flex items-center justify-between gap-2 text-left',
              className
            )}
          >
            {/* Selected label, or the placeholder */}
            <span className="min-w-0 flex items-center gap-2 truncate">
              <TruncatedText
                className={
                  selectedOption === undefined ? SELECT_PLACEHOLDER_CLASS_NAME : 'text-foreground'
                }
              >
                {selectedOption?.label ?? placeholder}
              </TruncatedText>
            </span>

            {/* Open/closed indicator */}
            <span className="shrink-0 text-muted-foreground">
              <SelectChevron open={open} />
            </span>
          </ListboxButton>

          <ListboxOptions
            anchor="bottom start"
            className={cn('w-[var(--button-width)]', SELECT_PANEL_CLASS_NAME)}
          >
            {options.map((option) => {
              // The choice's own icon, if it carries one
              const Icon = option.icon

              // The row for this choice
              return (
                <ListboxOption
                  key={option.value}
                  value={option.value}
                  className={getSelectOptionClassName}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
                    <TruncatedText className={SELECT_OPTION_LABEL_CLASS_NAME}>
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
