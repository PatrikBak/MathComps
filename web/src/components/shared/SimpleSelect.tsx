'use client'

import { ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import * as React from 'react'

import {
  FacetListContainer,
  type FacetOption,
  FacetPopover,
  facetUI,
  useFacetBase,
} from '@/components/features/problems/components/facets/facet-shared'
import { TruncatedText } from '@/components/shared/components/TruncatedText'
import { ACCENT_COLOR_MAP } from '@/components/shared/utils/accent-colors'
import { cn } from '@/components/shared/utils/css-utils'

interface SimpleSelectProps {
  options: readonly {
    value: string
    label: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  id?: string
  className?: string
}

/**
 * A simple select component that reuses the facet infrastructure for consistent
 * styling, accessibility, and behavior.
 */
const CHEVRON_ICON_CLASSES = 'h-3.5 w-3.5 sm:h-4 sm:w-4'

export default function SimpleSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
}: SimpleSelectProps) {
  // Convert options to FacetOption format
  const facetOptions: FacetOption[] = React.useMemo(
    () =>
      options.map((option) => ({
        id: option.value,
        displayName: option.label,
      })),
    [options]
  )

  // Get translations for aria-labels
  const t = useTranslations('ui.filters')

  // Use provided placeholder or default translated one
  const effectivePlaceholder = placeholder ?? t('selectPlaceholder')

  // Convert single value to array format expected by facet
  const selectedValues = React.useMemo(() => (value ? [value] : []), [value])

  const {
    open,
    setOpen,
    refs,
    floatingStyles,
    context,
    getReferenceProps,
    getFloatingProps,
    onListKeyDown,
    labelId,
    popoverId,
    listRef,
  } = useFacetBase({
    options: facetOptions,
    inputKind: 'radio',
    selected: selectedValues,
  })

  const selectedOption = options.find((option) => option.value === value)
  const displayText = selectedOption ? selectedOption.label : effectivePlaceholder

  const handleOptionChange = React.useCallback(
    (optionValue: string) => {
      onChange(optionValue)
      setOpen(false)
    },
    [onChange, setOpen]
  )

  return (
    <div className="relative">
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        className={cn(facetUI.trigger, className)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={open ? t('closePopover') : t('openPopover', { name: '' })}
      >
        {/* Left: label */}
        <span className="min-w-0 flex items-center gap-2 truncate">
          <TruncatedText className="text-foreground">{displayText}</TruncatedText>
        </span>

        {/* Right: chevron state icon */}
        <span className={facetUI.triggerIconBox}>
          {open ? (
            <ChevronUp className={CHEVRON_ICON_CLASSES} aria-hidden="true" />
          ) : (
            <ChevronDown className={CHEVRON_ICON_CLASSES} aria-hidden="true" />
          )}
        </span>
      </button>

      <FacetPopover
        open={open}
        context={context}
        refs={refs}
        floatingStyles={floatingStyles}
        getFloatingProps={getFloatingProps}
        popoverId={popoverId}
        labelId={labelId}
      >
        <FacetListContainer
          role="radiogroup"
          labelId={labelId}
          listRef={listRef}
          onKeyDown={onListKeyDown}
        >
          {facetOptions.map((facetOption) => (
            <label
              key={facetOption.id}
              className={cn(
                'flex items-center justify-between gap-2 sm:gap-3 rounded-md px-2.5 sm:px-3 py-1.5 sm:py-2 transition-colors cursor-pointer',
                'hover:bg-foreground/5',
                facetOption.id === value &&
                  cn(ACCENT_COLOR_MAP.indigo.bg, 'ring-1 ring-inset ring-focus/30')
              )}
              onClick={() => handleOptionChange(facetOption.id)}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {(() => {
                  const originalOption = options.find((option) => option.value === facetOption.id)
                  const IconComponent = originalOption?.icon
                  return IconComponent ? (
                    <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : null
                })()}
                <TruncatedText className="truncate text-xs sm:text-sm font-medium text-foreground">
                  {facetOption.displayName}
                </TruncatedText>
              </div>
            </label>
          ))}
        </FacetListContainer>
      </FacetPopover>
    </div>
  )
}
