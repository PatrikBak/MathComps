'use client'

import { Check, Pencil, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the IconButton component.
 */
type IconButtonProps = {
  /** The click handler */
  onClick: (event: React.MouseEvent) => void
  /** The class name */
  className?: string
  /** The aria label */
  label: string
  /** The children */
  children: React.ReactNode
}

/**
 * Small buttons used to turn on editing or submit/cancel changes
 */
const IconButton = ({ onClick, className, label, children }: IconButtonProps) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation()
      onClick(event)
    }}
    aria-label={label}
    className={cn('p-1 -m-1 rounded-md transition-colors', className)}
  >
    {children}
  </button>
)

/**
 * Props for the EditableTextField component.
 */
type EditableTextFieldProps = {
  /** The current value to display */
  value?: string
  /** Async callback function to save the new value. It owns reporting its own failure. */
  onSave: (value?: string) => Promise<void>
  /** Zod schema for validation */
  schema: z.ZodString
  /** Label for accessibility */
  label: string
  /** Placeholder for the input */
  placeholder?: string
  /** Font style for the text */
  textClassName?: string
  /** Font style for the placeholder */
  placeholderClassName?: string
  /**The style applied to the container wrapping everything */
  outerContainerClassName?: string
  /** The style applied to the container wrapping the text / input.*/
  innerContainerClassName?: string
  /** The style applied to the edit/submit/cancel icons */
  iconClassName?: string
  /** Size of the action icons in pixels */
  iconSize: number
  /** Additional class for the actions button container (e.g. spacing) */
  actionsClassName?: string
}

/**
 * A reusable component that displays text which can be edited inline.
 * Shows a pencil icon on hover, and switches to an input field on click.
 * Automatically saves on blur or Enter key, cancels on Escape.
 * Maintains the same visual layout in both display and edit modes.
 */
export function EditableTextField({
  value,
  onSave,
  schema,
  label,
  placeholder,
  textClassName,
  placeholderClassName,
  outerContainerClassName,
  innerContainerClassName,
  iconClassName,
  iconSize,
  actionsClassName,
}: EditableTextFieldProps) {
  // State to track if we're in edit mode
  const [isEditing, setIsEditing] = useState(false)
  // State to track the current input value
  const [inputValue, setInputValue] = useState(value)
  // State to track if the save operation is in progress
  const [isSaving, setIsSaving] = useState(false)
  // Ref to prevent double save calls (race condition between onBlur and onClick in production)
  const isSavingRef = useRef(false)
  // State to store validation errors
  const [error, setError] = useState<string | null>(null)
  // State to trigger error pulse animation on validation error
  const [isPulsing, setIsPulsing] = useState(false)
  // Ref to the container for click-outside detection / focus management
  const containerRef = useRef<HTMLDivElement>(null)
  // Ref to the input element for focus management / custom input trimming
  const inputRef = useRef<HTMLInputElement>(null)
  // Ref to track the value when editing starts so we can cancel and go back
  const startValueRef = useRef(value)
  // Get translations
  const tActions = useTranslations('ui.actions')

  // Sync inputValue with external value changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus()
    }
  }, [isEditing])

  /**
   * Handles saving the new value.
   * Validates, calls onSave callback, and exits edit mode.
   */
  const handleSave = async () => {
    // Guard against double save calls (race condition between onBlur and onClick)
    if (isSavingRef.current) return
    isSavingRef.current = true

    // Trim the input value
    const trimmedValue = inputValue?.trim()

    // Reset error
    setError(null)

    // Don't save if value hasn't changed
    if (trimmedValue === startValueRef.current) {
      setIsEditing(false)
      isSavingRef.current = false
      return
    }

    try {
      // Ensure the value is valid
      schema.parse(trimmedValue)
    } catch (error) {
      // Set error if validation fails
      if (error instanceof z.ZodError) {
        setError(error.issues[0]?.message)
      }
      // Trigger error pulse animation
      setIsPulsing(true)
      setTimeout(() => setIsPulsing(false), 500)
      // We'll stay in the edit mode
      isSavingRef.current = false
      return
    }

    // Start saving (shows loading spinner)
    setIsSaving(true)

    try {
      // Call the onSave callback
      await onSave(trimmedValue)

      // If success, exit edit mode
      setIsEditing(false)

      // Reflect the new value
      setInputValue(trimmedValue)

      // Display a toast with a success message
      toast.success(tActions('savedSuccessfully'))
    } catch {
      // The caller reports the failure, so nothing is shown here. The rejection is still swallowed: a
      // blur-triggered save is never awaited, so letting it through would surface as an unhandled
      // rejection. Edit mode stays on so the typed value survives another attempt.
    } finally {
      // Saving done in any case
      setIsSaving(false)
      isSavingRef.current = false
    }
  }

  /**
   * Handles canceling the edit.
   */
  const handleCancel = () => {
    // Reset the value
    setInputValue(startValueRef.current)

    // Reset the error
    setError(null)

    // Exit edit mode
    setIsEditing(false)

    // Focus the container
    containerRef.current?.focus({ preventScroll: true })
  }

  /**
   * Handles key presses in the input field.
   * Enter -> save, Escape -> cancel
   *
   * @param event - The keyboard event
   */
  const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter -> save
    if (event.key === 'Enter') {
      event.preventDefault()
      await handleSave()
    }
    // Escape -> cancel
    else if (event.key === 'Escape') {
      event.preventDefault()
      handleCancel()
    }
  }

  /**
   * Starts the editing mode.
   */
  const startEditing = () => {
    // We need to remember the value before editing started to be able to cancel
    startValueRef.current = inputValue

    // The edit mode triggerred
    setIsEditing(true)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'cursor-pointer group w-full rounded-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-focus',
        isPulsing && 'animate-error-pulse',
        outerContainerClassName
      )}
      onClick={() => {
        // Click -> edit
        if (!isEditing && !isSaving) {
          startEditing()
        }
      }}
      onKeyDown={(event) => {
        // Space or Enter while focused -> edit
        if (!isEditing && (event.key === 'Enter' || event.key === ' ')) {
          startEditing()
          event.preventDefault()
        }
      }}
      role="button"
      tabIndex={isEditing ? -1 : 0}
      aria-label={tActions('editField', { field: label || 'text' })}
    >
      {/* Inner container for the text inputs and action buttons */}
      <div className={cn('relative flex gap-3', innerContainerClassName)}>
        {/* Inner container with inputs */}
        <div className="relative grid [&>*]:col-start-1 [&>*]:row-start-1 whitespace-pre truncate">
          {/* Invisible text which makes sure the container's width and height won't shrink to 0 */}
          <div className="min-w-0 opacity-0 flex-1 grid [&>*]:col-start-1 [&>*]:row-start-1 pr-1">
            {/* Both input and placeholder must fit */}
            <div className={textClassName}>
              {(inputValue || '').replace(/ /g, '\u00A0') || '\u00A0'}
            </div>
            <div className={cn(textClassName, placeholderClassName)}>{placeholder || '\u00A0'}</div>
          </div>

          {/* Display text */}
          {!isEditing && (
            <input
              type="text"
              value={inputValue ?? ''}
              placeholder={placeholder}
              disabled
              readOnly
              tabIndex={-1}
              className={cn(
                'absolute inset-0 truncate min-w-0 w-full min-h-0 p-0 h-full bg-transparent border-none outline-none ring-0 pointer-events-none',
                textClassName,
                !inputValue && placeholderClassName
              )}
            />
          )}

          {/* Input overlay - positioned absolutely over the text */}
          {isEditing && (
            <input
              ref={inputRef}
              type="text"
              value={inputValue ?? ''}
              placeholder={placeholder}
              onKeyDown={handleKeyDown}
              onBlur={(event) => {
                // Check if the element receiving focus is one of our action buttons
                // e.relatedTarget is the element that is about to receive focus
                // If so, do nothing and onClick will do the rest (if there was a click)
                if (containerRef.current?.contains(event.relatedTarget as Node)) {
                  return
                }
                // Otherwise, treat losing focus as a Save intent
                handleSave()
              }}
              onChange={(event) => {
                // Get new value
                const newValue = event.target.value

                // Trigger validation manually
                const result = schema.safeParse(newValue)

                // Update the input value only if it's valid
                if (result.success) {
                  setInputValue(newValue)
                  setError(null)
                }
                // If value is invalid...
                else {
                  // Set error message
                  setError(result.error.issues[0]?.message)

                  // Check if it's a max length error specifically
                  const maxLengthError = result.error.issues.find(
                    (issue) => issue.code === 'too_big'
                  )

                  // If it's a max length error, don't display too many characters
                  setInputValue(
                    maxLengthError ? newValue.slice(0, maxLengthError.maximum as number) : newValue
                  )
                }
              }}
              disabled={isSaving}
              className={cn(
                'absolute inset-0 truncate min-w-0 min-h-0 p-0 w-full h-full bg-transparent focus:outline-none focus:ring-0 focus:border-none border-none outline-none ring-0',
                textClassName,
                !inputValue && placeholderClassName
              )}
              aria-label={label || tActions('edit')}
            />
          )}
        </div>

        {/* Action buttons on the right */}
        <div className={cn('flex items-center gap-2 shrink-0 ml-auto', actionsClassName)}>
          {/* Action buttons - visible only when editing */}
          {isEditing && !isSaving && (
            <>
              {/* Save button */}
              <IconButton
                onClick={handleSave}
                className="hover:bg-success/20 text-success"
                label={tActions('save')}
              >
                <Check size={iconSize} className={iconClassName} />
              </IconButton>

              {/* Cancel button */}
              <IconButton
                onClick={handleCancel}
                className="hover:bg-error/20 text-error"
                label={tActions('cancel')}
              >
                <X size={iconSize} className={iconClassName} />
              </IconButton>
            </>
          )}

          {/* Pencil icon on hover - only show when not editing */}
          {!isEditing && (
            <IconButton
              onClick={startEditing}
              className="text-muted opacity-0 group-hover:opacity-100 hover:bg-muted/20"
              label={tActions('edit')}
            >
              <Pencil size={iconSize} className={iconClassName} />
            </IconButton>
          )}

          {/* Loading spinner overlay */}
          {isSaving && (
            <LoadingSpinner style={iconSize ? { width: iconSize, height: iconSize } : undefined} />
          )}
        </div>
      </div>

      {/* Error message below - always reserve space */}
      <div
        className={cn(
          'absolute mt-1 text-xs text-error text-center px-2 max-w-xs mx-auto transition-opacity duration-200',
          error ? 'opacity-100' : 'opacity-0'
        )}
      >
        {error}
      </div>
    </div>
  )
}
