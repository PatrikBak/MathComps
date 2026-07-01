import {
  Heart,
  Lightbulb,
  type LucideIcon,
  MessageSquare,
  MoreHorizontal,
  Users,
} from 'lucide-react'
import { type Messages, type useTranslations } from 'next-intl'
import { getTranslations } from 'next-intl/server'

/**
 * The contact namespace's translation function.
 */
type ContactTranslator = ReturnType<typeof useTranslations<'contact'>>

/**
 * Union type of valid contact.reasons.* translation keys.
 */
type ReasonLabelKey = `reasons.${string & keyof Messages['contact']['reasons']}`

/**
 * A contact reason's config.
 */
type ReasonConfig = {
  /** Translation key under contact.reasons for the reason's label */
  labelKey: ReasonLabelKey
  /** Icon shown next to the reason */
  icon: LucideIcon
}

/**
 * The selectable contact reasons, each paired with the icon shown in the form.
 * labelKey values must match keys under contact.reasons in messages/[locale].json.
 */
export const REASON_OPTIONS = {
  sponsorship: { labelKey: 'reasons.sponsorship', icon: Heart },
  feedback: { labelKey: 'reasons.feedback', icon: MessageSquare },
  contentContribution: { labelKey: 'reasons.contentContribution', icon: Users },
  featureIdeas: { labelKey: 'reasons.featureIdeas', icon: Lightbulb },
  other: { labelKey: 'reasons.other', icon: MoreHorizontal },
} satisfies Record<string, ReasonConfig>

/**
 * One of the contact form's reason keys.
 */
export type ReasonOption = keyof typeof REASON_OPTIONS

/**
 * The reason keys as a non-empty tuple, for Zod enum typing.
 */
export const REASON_KEYS = Object.keys(REASON_OPTIONS) as [ReasonOption, ...ReasonOption[]]

/**
 * A contact reason paired with its display-ready translated label.
 */
type TranslatedReasonOption = {
  /** The reason key */
  value: ReasonOption
  /** The reason's translated label */
  label: string
  /** Icon shown next to the reason */
  icon: LucideIcon
}

/**
 * Pairs each reason with its translated label.
 *
 * @param t - The contact-namespace translator
 *
 * @returns The reason options with translated labels
 */
export function getTranslatedReasonOptions(t: ContactTranslator): TranslatedReasonOption[] {
  // Map each reason to its value, translated label, and icon
  return (Object.entries(REASON_OPTIONS) as [ReasonOption, ReasonConfig][]).map(
    ([value, { labelKey, icon }]) => ({
      value,
      label: t(labelKey),
      icon,
    })
  )
}

/**
 * Resolves a reason's label for the admin notification email. Those emails always read
 * in English regardless of the sender's locale, so the label is fetched in 'en'.
 *
 * @param reason - The reason value
 *
 * @returns The English label for the reason
 */
export async function getReasonLabelForAdmin(reason: ReasonOption): Promise<string> {
  // Grab the reason's option entry
  const option = REASON_OPTIONS[reason]

  // Translate it in English, the admin email's fixed locale
  const t = await getTranslations({ locale: 'en', namespace: 'contact' })

  // Hand back the English label
  return t(option.labelKey)
}
