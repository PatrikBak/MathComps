import { type LucideIcon } from 'lucide-react'
import { type UseFormRegisterReturn } from 'react-hook-form'

import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link InputField} component.
 */
type InputFieldProps = {
  /** Unique identifier for the input field */
  id: string
  /** Label text displayed above the input */
  label: string
  /** Icon component to display inside the input */
  icon: LucideIcon
  /** Placeholder text for the input */
  placeholder: string
  /** HTML input type (text, password, email, etc.) */
  type?: string
  /** Error object containing validation message */
  error?: { message?: string }
  /** React Hook Form registration object */
  registration: UseFormRegisterReturn
  /** Maximum allowed length for the input value */
  maxLength?: number
  /** Optional CSS class for custom styling */
  className?: string
}

/**
 * Private component for form input fields with icon and error handling.
 * Used to avoid duplicating the input field pattern across multiple fields.
 */
export function InputField({
  id,
  label,
  icon: Icon,
  placeholder,
  type = 'text',
  error,
  registration,
  maxLength,
  className,
}: InputFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-2">
        {label}
      </label>
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Icon className="h-4 w-4 text-slate-400" />
        </span>
        <input
          {...registration}
          type={type}
          id={id}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            'w-full bg-slate-800/60 border text-slate-200 rounded-lg text-sm px-3 py-2.5 pl-10 transition-all outline-none focus:border-indigo-500/70 focus:bg-slate-800/80 focus:ring-2 focus:ring-indigo-500/30 hover:border-slate-400/60 hover:bg-slate-800/70',
            !!error ? 'border-red-500/70' : 'border-slate-500/50',
            className
          )}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-300">{error.message}</p>}
    </div>
  )
}
