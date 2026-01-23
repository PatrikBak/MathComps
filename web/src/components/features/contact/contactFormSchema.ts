import { Heart, Lightbulb, type LucideIcon, MessageSquare, Users } from 'lucide-react'
import { type Messages, type useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

/**
 * Type for the validation translation function.
 */
type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>

/**
 * Type for the contact translation function (for reason labels).
 */
type ContactTranslator = ReturnType<typeof useTranslations<'contact'>>

/**
 * Union type of valid contact.reasons.* translation keys.
 * Derived from the Messages type so TypeScript catches missing keys at compile time.
 */
type ReasonLabelKey = `reasons.${string & keyof Messages['contact']['reasons']}`

/**
 * Options for the contact form reason field.
 * labelKey values must match keys defined in messages/[locale].json under contact.reasons
 */
export const REASON_OPTIONS: Record<string, { labelKey: ReasonLabelKey; icon: LucideIcon }> = {
  sponsorship: {
    labelKey: 'reasons.sponsorship',
    icon: Heart,
  },
  feedback: {
    labelKey: 'reasons.feedback',
    icon: MessageSquare,
  },
  contentContribution: {
    labelKey: 'reasons.contentContribution',
    icon: Users,
  },
  featureIdeas: {
    labelKey: 'reasons.featureIdeas',
    icon: Lightbulb,
  },
}

/**
 * Type for the contact form reason field.
 */
export type ReasonOption = keyof typeof REASON_OPTIONS

/**
 * Array of reason keys for Zod enum typing.
 */
const REASON_KEYS = Object.keys(REASON_OPTIONS) as [ReasonOption, ...ReasonOption[]]

/**
 * Creates the contact form schema with optional translated validation messages.
 *
 * - With translator: Used on the frontend for user-facing validation errors
 * - Without translator: Used server-side where validation errors aren't shown to users
 *
 * @param t - Optional translation function from useTranslations
 *
 * @returns The contact form Zod schema
 */
export function createContactFormSchema(t?: ValidationTranslator) {
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
 * Server-side contact form schema (no translated messages).
 */
export const baseContactFormSchema = createContactFormSchema()

/**
 * Type for the contact form schema.
 */
type ContactFormSchema = ReturnType<typeof createContactFormSchema>

/**
 * Type inference for contact form data.
 */
export type ContactFormData = z.infer<ContactFormSchema>

/**
 * Get translated reason options with labels.
 *
 * @param t - The translation function from useTranslations('contact')
 *
 * @returns Array of reason options with translated labels
 */
export function getTranslatedReasonOptions(t: ContactTranslator) {
  return (
    Object.entries(REASON_OPTIONS) as [ReasonOption, (typeof REASON_OPTIONS)[ReasonOption]][]
  ).map(([value, { labelKey, icon }]) => ({
    value,
    label: t(labelKey),
    icon,
  }))
}

/**
 * Get the translated display label for a reason value.
 * Used for server-side code like admin email notifications.
 * Uses English locale for.
 *
 * @param reason - The reason value
 *
 * @returns The English label for the reason
 */
export async function getReasonLabelForAdmin(reason: ReasonOption): Promise<string> {
  // Find the option with the matching value
  const option = REASON_OPTIONS[reason]

  // Get the translation function for the English locale
  const t = await getTranslations({ locale: 'en', namespace: 'contact' })

  // Return the translated label
  return t(option.labelKey)
}
