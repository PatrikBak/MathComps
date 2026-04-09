'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AtSign, BookMarked, Loader2, MessageSquare, Send, User } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'

import SimpleSelect from '../../shared/SimpleSelect'
import {
  type ContactFormData,
  createContactFormSchema,
  getTranslatedReasonOptions,
  REASON_OPTIONS,
  type ReasonOption,
} from './contactFormSchema'

interface ContactFormProps {
  defaultReason?: ReasonOption
  onSubmit: (data: ContactFormData) => void
  isSubmitting?: boolean
}

const formClasses = {
  baseInput: 'form-input flex items-center justify-between gap-2 bg-surface/95',
  iconSpan: 'absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-3.5 pointer-events-none',
  icon: 'h-4 w-4 sm:h-5 sm:w-5 text-foreground',
  label: 'block text-xs sm:text-sm font-medium text-muted-foreground mb-1.5 sm:mb-2',
  error: 'mt-1 text-xs sm:text-sm text-error',
  inputWithIcon: 'pl-10 sm:pl-11',
  submitButton:
    'w-full flex items-center justify-center gap-2 bg-brand/70 hover:bg-brand/80 disabled:bg-brand/30 text-brand-foreground font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 focus:ring-offset-inset text-sm sm:text-base',
}

export default function ContactForm({
  defaultReason,
  onSubmit,
  isSubmitting = false,
}: ContactFormProps) {
  // Get translations for contact form
  const tContact = useTranslations('contact')
  const tValidation = useTranslations('validation')

  // Create the schema with translated validation messages
  const contactFormSchema = useMemo(() => createContactFormSchema(tValidation), [tValidation])

  // Get translated reason options for the select
  const translatedReasonOptions = useMemo(() => getTranslatedReasonOptions(tContact), [tContact])

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      ...(defaultReason && { reason: defaultReason }),
    },
  })

  const selectedReason = watch('reason')

  const handleFormSubmit = (data: ContactFormData) => {
    onSubmit(data)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 sm:space-y-6">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className={formClasses.label}>
          {tContact('name')} *
        </label>
        <div className="relative">
          <span className={formClasses.iconSpan}>
            <User className={formClasses.icon} />
          </span>
          <input
            {...register('name')}
            type="text"
            id="name"
            className={`${formClasses.baseInput} ${formClasses.inputWithIcon}`}
            placeholder={tContact('namePlaceholder')}
          />
        </div>
        {errors.name && <p className={formClasses.error}>{errors.name.message}</p>}
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className={formClasses.label}>
          {tContact('email')} *
        </label>
        <div className="relative">
          <span className={formClasses.iconSpan}>
            <AtSign className={formClasses.icon} />
          </span>
          <input
            {...register('email')}
            type="email"
            id="email"
            className={`${formClasses.baseInput} ${formClasses.inputWithIcon}`}
            placeholder={tContact('emailPlaceholder')}
          />
        </div>
        {errors.email && <p className={formClasses.error}>{errors.email.message}</p>}
      </div>

      {/* Reason Field */}
      <div>
        <label htmlFor="reason" className={formClasses.label}>
          {tContact('subject')} *
        </label>
        <div className="relative">
          <span className={`${formClasses.iconSpan} z-10`}>
            {(() => {
              const selectedOption = REASON_OPTIONS[selectedReason]
              const IconComponent = selectedOption?.icon || BookMarked
              return <IconComponent className={formClasses.icon} />
            })()}
          </span>
          <SimpleSelect
            id="reason"
            options={translatedReasonOptions}
            value={selectedReason || ''}
            onChange={(value) => setValue('reason', value as ReasonOption)}
            placeholder={tContact('selectPlaceholder')}
            className={formClasses.inputWithIcon}
          />
        </div>
        <input {...register('reason')} type="hidden" value={selectedReason || ''} />
        {errors.reason && <p className={formClasses.error}>{errors.reason.message}</p>}
      </div>

      {/* Message Field */}
      <div>
        <label htmlFor="message" className={formClasses.label}>
          {tContact('message')} *
        </label>
        <div className="relative">
          <span className={`${formClasses.iconSpan} items-start pt-2.5 sm:pt-3`}>
            <MessageSquare className={formClasses.icon} />
          </span>
          <textarea
            {...register('message')}
            id="message"
            rows={3}
            className={`${formClasses.baseInput} resize-vertical sm:rows-4 ${formClasses.inputWithIcon}`}
            placeholder={tContact('messagePlaceholder')}
          />
        </div>
        {errors.message && <p className={formClasses.error}>{errors.message.message}</p>}
      </div>

      {/* Honeypot field */}
      <div style={{ display: 'none' }}>
        <label htmlFor="website">{tContact('websiteLabel')}</label>
        <input {...register('website')} type="text" id="website" tabIndex={-1} autoComplete="off" />
      </div>

      {/* Submit Button */}
      <button type="submit" disabled={isSubmitting} className={formClasses.submitButton}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            {tContact('sending')}
          </>
        ) : (
          <>
            {tContact('sendMessage')}
            <Send className="h-4 w-4 sm:h-5 sm:w-5" />
          </>
        )}
      </button>
    </form>
  )
}
