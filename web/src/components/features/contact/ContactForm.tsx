'use client'

import { useUser } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, BookMarked, type LucideIcon, MessageSquare, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { type ReactNode, useMemo } from 'react'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/shared/components/Button'

import SimpleSelect from '../../shared/SimpleSelect'
import { cn } from '../../shared/utils/css-utils'
import { getTranslatedReasonOptions, REASON_OPTIONS, type ReasonOption } from './contact-reasons'
import { type ContactFormData, createContactFormSchema } from './contact-schema'

/**
 * Props for {@link ContactForm}.
 */
type ContactFormProps = {
  /** Reason to pre-select when the form opens */
  defaultReason?: ReasonOption
  /** Called with the validated payload to submit */
  onSubmit: (data: ContactFormData) => Promise<void>
}

/**
 * Props for {@link ContactField}.
 */
type ContactFieldProps = {
  /** The control's id, tying it to the label */
  id: string
  /** The field's label text (a required marker is appended) */
  label: string
  /** Icon shown at the start of the field */
  icon: LucideIcon
  /** Validation error to show beneath the field, if any */
  error?: string
  /** Top-align the icon, for a multi-line control */
  iconAtTop?: boolean
  /** Lift the icon above the control, when the control paints over it */
  raiseIcon?: boolean
  /** The field's input control */
  children: ReactNode
}

/**
 * A labelled field: its label, a leading icon, and any validation error around the control.
 */
function ContactField({
  id,
  label,
  icon: Icon,
  error,
  iconAtTop = false,
  raiseIcon = false,
  children,
}: ContactFieldProps) {
  // Stack the label, the control with its leading icon, and the error
  return (
    <div>
      {/* Label */}
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2"
      >
        {label} *
      </label>
      {/* Control with a leading icon */}
      <div className="relative">
        <span
          className={cn(
            'absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-3.5 pointer-events-none',
            iconAtTop && 'items-start pt-2.5 sm:pt-3',
            raiseIcon && 'z-10'
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-foreground" aria-hidden="true" />
        </span>
        {children}
      </div>
      {/* Validation error */}
      {error && (
        <p role="alert" className="mt-1 text-xs sm:text-sm text-error">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * The contact form fields and validation; submission is delegated to the parent
 * via {@link ContactFormProps.onSubmit}.
 */
export default function ContactForm({ defaultReason, onSubmit }: ContactFormProps) {
  // Translators for the form copy and the validation messages
  const tContact = useTranslations('contact')
  const tValidation = useTranslations('validation')

  // Build the schema with translated validation messages
  const contactFormSchema = useMemo(() => createContactFormSchema(tValidation), [tValidation])

  // Reason options carrying their translated labels
  const translatedReasonOptions = useMemo(() => getTranslatedReasonOptions(tContact), [tContact])

  // Seed name + email from the signed-in user, if any. We repurpose Clerk's
  // firstName as the user's single display name, so the name field seeds from it.
  const { user, isLoaded } = useUser()
  const displayName = user?.firstName ?? ''
  const email = user?.primaryEmailAddress?.emailAddress ?? ''

  // Reactive seed: display name + email from Clerk, the rest empty until the user fills them.
  const values = useMemo<ContactFormData>(
    () => ({
      name: displayName,
      email,
      reason: defaultReason as ReasonOption,
      message: '',
      website: '',
    }),
    [displayName, email, defaultReason]
  )

  // Form state and helpers, validated against the schema
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, dirtyFields, isSubmitted },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    // Reactively adopt the Clerk seed once it resolves
    values,
    // Keep anything the user already typed
    resetOptions: { keepDirtyValues: true },
    // Validate each field once it's been touched
    mode: 'onTouched',
  })

  // Aim the dialog's initial focus at the first unfilled field once Clerk resolves:
  // the message when signed in (name/email are prefilled), otherwise the name. The
  // modal's focus trap focuses the data-autofocus element itself, so focus lands cleanly.
  const focusName = isLoaded && !user
  const focusMessage = isLoaded && Boolean(user)

  // Mirror the chosen reason so its matching icon shows in the field
  const selectedReason = watch('reason')
  const ReasonIcon = REASON_OPTIONS[selectedReason]?.icon ?? BookMarked

  // A field's error, shown only once the user has touched it or tried to submit — so an
  // untouched field (like the one focused on open) never flashes "required" on close.
  const fieldError = (name: keyof ContactFormData) =>
    dirtyFields[name] || isSubmitted ? errors[name]?.message : undefined

  // Render the labelled fields, the reason select, and the submit button
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {/* Name */}
      <ContactField id="name" label={tContact('name')} icon={User} error={fieldError('name')}>
        <input
          {...register('name')}
          type="text"
          id="name"
          autoComplete="name"
          data-autofocus={focusName ? '' : undefined}
          className="form-input flex items-center justify-between gap-2 bg-surface/95 pl-10 sm:pl-11"
          placeholder={tContact('namePlaceholder')}
        />
      </ContactField>

      {/* Email */}
      <ContactField id="email" label={tContact('email')} icon={AtSign} error={fieldError('email')}>
        <input
          {...register('email')}
          type="email"
          id="email"
          autoComplete="email"
          className="form-input flex items-center justify-between gap-2 bg-surface/95 pl-10 sm:pl-11"
          placeholder={tContact('emailPlaceholder')}
        />
      </ContactField>

      {/* Reason */}
      <ContactField
        id="reason"
        label={tContact('subject')}
        icon={ReasonIcon}
        error={fieldError('reason')}
        raiseIcon
      >
        <Controller
          name="reason"
          control={control}
          render={({ field }) => (
            <SimpleSelect
              id="reason"
              options={translatedReasonOptions}
              value={field.value ?? ''}
              onChange={field.onChange}
              placeholder={tContact('selectPlaceholder')}
              className="pl-10 sm:pl-11"
            />
          )}
        />
      </ContactField>

      {/* Message */}
      <ContactField
        id="message"
        label={tContact('message')}
        icon={MessageSquare}
        error={fieldError('message')}
        iconAtTop
      >
        <textarea
          {...register('message')}
          id="message"
          rows={3}
          data-autofocus={focusMessage ? '' : undefined}
          className="form-input flex items-center justify-between gap-2 bg-surface/95 resize-vertical sm:rows-4 pl-10 sm:pl-11"
          placeholder={tContact('messagePlaceholder')}
        />
      </ContactField>

      {/* Honeypot - hidden from real users, filled only by bots */}
      <div style={{ display: 'none' }}>
        <label htmlFor="website">{tContact('websiteLabel')}</label>
        <input {...register('website')} type="text" id="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Submit */}
      <Button variant="primary" fullWidth type="submit" loading={isSubmitting}>
        {tContact('sendMessage')}
      </Button>
    </form>
  )
}
