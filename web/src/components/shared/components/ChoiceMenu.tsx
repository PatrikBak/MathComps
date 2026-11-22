import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useId } from 'react'

import { cn } from '../utils/css-utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './DropdownMenu'

/**
 * One option of a {@link ChoiceMenu}.
 */
export type ChoiceMenuOption<TValue extends string> = {
  /** What the option stands for. */
  value: TValue
  /** What the option reads. */
  label: string
  /** The option's colour while it is the one picked, in place of the brand's violet; null for the violet. */
  checkedClass: string | null
}

/**
 * A choice of exactly one option, as a {@link ChoiceMenu} or a {@link ChoiceMenuGroup} offers it.
 */
export type Choice<TValue extends string> = {
  /** What the choice is about. */
  name: string
  /** The option picked. */
  value: TValue
  /** Every option, in the order the menu lists them. */
  options: ChoiceMenuOption<TValue>[]
  /** Picks an option. */
  onChange: (value: TValue) => void
}

/**
 * A choice as a headed group of rows inside a dropdown menu, the option picked carrying a check.
 */
export function ChoiceMenuGroup<TValue extends string>({
  name,
  value,
  options,
  onChange,
}: Choice<TValue>) {
  // The heading's id
  const headingId = useId()

  // A function which picks the option a row stands for
  const handleValueChange = (pickedValue: string) => {
    // The option picked, which is always one of the menu's own
    const picked = options.find((option) => option.value === pickedValue)

    // Handed on as the choice's own value
    if (picked) onChange(picked.value)
  }

  return (
    <>
      {/* What the choice is about */}
      <DropdownMenuLabel id={headingId}>{name}</DropdownMenuLabel>

      {/* The options, named by the heading over them */}
      <DropdownMenuRadioGroup
        aria-labelledby={headingId}
        value={value}
        onValueChange={handleValueChange}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option.value}
            value={option.value}
            className={cn('cursor-pointer', option.checkedClass)}
          >
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  )
}

/**
 * The props of {@link ChoiceMenu}.
 */
type ChoiceMenuProps<TValue extends string> = Choice<TValue> & {
  /** The mark the trigger carries. */
  icon: LucideIcon
  /** The trigger's look. */
  triggerClassName: string
}

/**
 * A choice of exactly one option behind a small trigger reading the choice's name, such as a filter or a way of
 * drawing a list. The menu lists the options under that name, the one picked checked.
 */
export function ChoiceMenu<TValue extends string>({
  icon: Icon,
  triggerClassName,
  ...choice
}: ChoiceMenuProps<TValue>) {
  return (
    <DropdownMenu>
      {/* Trigger, reading the choice's name */}
      <DropdownMenuTrigger asChild>
        <button className={cn(triggerClassName, 'gap-1')}>
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{choice.name}</span>
          <ChevronDown className="h-3 w-3 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      {/* The options */}
      <DropdownMenuContent align="end" className="min-w-40">
        <ChoiceMenuGroup {...choice} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
