'use client'

import { Radio, RadioGroup } from '@headlessui/react'
import type { ReactNode } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * One option of a {@link SegmentedSwitch}.
 */
type SegmentedSwitchOption<TValue extends string> = {
  /** What picking the option switches to. */
  value: TValue
  /** What the option reads. */
  label: ReactNode
  /** Why the option is out of reach, which dims it and shows on hover; undefined while it can be picked. */
  unavailableReason?: string
}

/**
 * Props for the {@link SegmentedSwitch} component.
 */
type SegmentedSwitchProps<TValue extends string> = {
  /** The option picked. */
  value: TValue
  /** Switches to another option. */
  onChange: (value: TValue) => void
  /** Accessible name for the switch. */
  ariaLabel: string
  /** The options, in the order they read. */
  options: readonly SegmentedSwitchOption<TValue>[]
}

/**
 * A switch between a few options, as one small segmented control: a single stop for Tab, with the arrow keys moving
 * between the options.
 */
export function SegmentedSwitch<TValue extends string>({
  value,
  onChange,
  ariaLabel,
  options,
}: SegmentedSwitchProps<TValue>) {
  return (
    <RadioGroup
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      className="inline-flex shrink-0 rounded-lg border border-foreground/10 p-0.5"
    >
      {options.map((option) => (
        <Radio
          key={option.value}
          value={option.value}
          disabled={option.unavailableReason !== undefined}
          title={option.unavailableReason}
          className={cn(
            'inline-flex h-7 cursor-pointer items-center rounded-md px-2.5 text-xs font-semibold',
            'text-muted transition-colors hover:text-foreground',
            'focus:outline-none data-focus:ring-2 data-focus:ring-focus',
            'data-checked:bg-foreground/10 data-checked:text-foreground',
            'data-disabled:cursor-not-allowed data-disabled:opacity-35 data-disabled:hover:text-muted'
          )}
        >
          {option.label}
        </Radio>
      ))}
    </RadioGroup>
  )
}
