'use client'

import {
  Combobox,
  ComboboxButton,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from '@headlessui/react'
import { useMemo, useState } from 'react'

import {
  getSelectOptionClassName,
  SELECT_OPTION_LABEL_CLASS_NAME,
  SELECT_PANEL_CLASS_NAME,
  SelectChevron,
} from '@/components/shared/components/select/select-parts'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * One choice offered by a {@link SearchableSelect}.
 */
export type SearchableSelectOption = {
  /** What picking this choice yields. */
  value: string
  /** How the choice reads. */
  label: string
}

/**
 * The props of {@link SearchableSelect}.
 */
type SearchableSelectProps = {
  /** The choices on offer. */
  options: readonly SearchableSelectOption[]
  /** The value currently picked, or an empty string for none. */
  value: string
  /** Applies the value the user picked, empty when they cleared it. */
  onChange: (value: string) => void
  /** What to show before anything is picked. */
  placeholder: string
  /** What to show when nothing matches what was typed. */
  emptyMessage: string
  /** Names the control for a reader, since the trigger is an input rather than a labelled button. */
  ariaLabel: string
  /** Extra classes for the trigger. */
  className?: string
}

/**
 * Folds a label down to what a search should match it on, so a query typed without diacritics still finds it.
 *
 * @param label - The label as it reads.
 *
 * @returns The label lowercased with its accents removed.
 */
function foldForSearch(label: string): string {
  return label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * The house single-choice dropdown for a list too long to scroll through, which the plain `Select` covers.
 *
 * Matching is substring and not fuzzy: over a few hundred options a fuzzy score outranks the label the query
 * literally starts, which is the one the typist meant.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  emptyMessage,
  ariaLabel,
  className,
}: SearchableSelectProps) {
  // What the user has typed to narrow the list
  const [query, setQuery] = useState('')

  // The choice currently picked, if the value still names one
  const selectedOption = options.find((option) => option.value === value)

  // The choices the query leaves, with the ones it starts ahead of the ones it merely appears in
  const matchingOptions = useMemo(() => {
    // Everything is on offer while nothing has been typed
    const foldedQuery = foldForSearch(query.trim())
    if (foldedQuery === '') return options

    // Where the query sits in each label, dropping the ones it is nowhere in
    const scored = options
      .map((option) => ({ option, at: foldForSearch(option.label).indexOf(foldedQuery) }))
      .filter((match) => match.at >= 0)

    // A name the query starts is what the typist meant; the rest keep the order they came in
    return scored.sort((first, second) => first.at - second.at).map((match) => match.option)
  }, [options, query])

  return (
    <Combobox
      value={value}
      onChange={(picked: string | null) => {
        // Clearing through the input yields null, which the caller reads as nothing picked
        onChange(picked ?? '')

        // The next open starts from the whole list rather than the last thing typed
        setQuery('')
      }}
      onClose={() => setQuery('')}
      immediate
    >
      {({ open }) => (
        <>
          <div className="relative">
            <ComboboxInput
              aria-label={ariaLabel}
              displayValue={() => selectedOption?.label ?? ''}
              placeholder={placeholder}
              onChange={(event) => setQuery(event.target.value)}
              className={cn('form-input pr-9', className)}
            />

            {/* Open/closed indicator, which also opens the list when there is no caret in the input yet */}
            <ComboboxButton className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground">
              <SelectChevron open={open} />
            </ComboboxButton>
          </div>

          <ComboboxOptions
            anchor="bottom start"
            className={cn('w-[var(--input-width)] empty:hidden', SELECT_PANEL_CLASS_NAME)}
          >
            {matchingOptions.length === 0 ? (
              <p className="px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-muted">
                {emptyMessage}
              </p>
            ) : (
              matchingOptions.map((option) => (
                <ComboboxOption
                  key={option.value}
                  value={option.value}
                  className={getSelectOptionClassName}
                >
                  <TruncatedText className={SELECT_OPTION_LABEL_CLASS_NAME}>
                    {option.label}
                  </TruncatedText>
                </ComboboxOption>
              ))
            )}
          </ComboboxOptions>
        </>
      )}
    </Combobox>
  )
}
