import { type useTranslations } from 'next-intl'
import { z } from 'zod'

import { REASON_KEYS } from './contact-reasons'

/**
 * The validation namespace's translation function.
 */
type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>

/**
 * Builds the contact form Zod schema, optionally with translated validation messages.
 * With a translator the schema carries localized error messages; without, it validates silently.
 *
 * @returns The contact form Zod schema
 */
export function createContactFormSchema(t?: ValidationTranslator) {
  // Required name, email, reason, and message; website is the honeypot
  return z.object({
    name: z
      .string()
      .min(1, t?.('nameRequired'))
      .min(2, t ? t('nameMinLength', { count: 2 }) : undefined),
    email: z.email(t?.('invalidEmail')),
    reason: z.enum(REASON_KEYS, {
      message: t?.('selectValidSubject'),
    }),
    message: z
      .string()
      .min(1, t?.('messageRequired'))
      .min(10, t ? t('messageMinLength', { count: 10 }) : undefined),
    // Honeypot field - should always be empty for real users
    website: z.string().optional(),
  })
}

/**
 * The contact form schema with no localized messages.
 */
export const baseContactFormSchema = createContactFormSchema()

/**
 * The return type of {@link createContactFormSchema}.
 */
type ContactFormSchema = ReturnType<typeof createContactFormSchema>

/**
 * The validated contact form payload.
 */
export type ContactFormData = z.infer<ContactFormSchema>
