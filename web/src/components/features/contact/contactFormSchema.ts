import { Heart, Lightbulb, MessageSquare, Users } from 'lucide-react'
import { z } from 'zod'

// Define the reason options as a const assertion for better type inference
export const REASON_OPTIONS = [
  { value: 'sponsorship', label: 'Sponzorstvo', icon: Heart },
  { value: 'feedback', label: 'Spätná väzba', icon: MessageSquare },
  { value: 'content-contribution', label: 'Pomoc s obsahom', icon: Users },
  { value: 'feature-ideas', label: 'Nápady na funkcie', icon: Lightbulb },
] as const

// Create a discriminated union type
export type ReasonOption = (typeof REASON_OPTIONS)[number]['value']

// Create the schema with proper enum validation
export const contactFormSchema = z.object({
  name: z.string().min(1, 'Meno je povinné').min(2, 'Meno musí mať aspoň 2 znaky'),
  email: z.email('Prosím zadajte platnú emailovú adresu'),
  reason: z.enum(REASON_OPTIONS.map((option) => option.value) as [string, ...string[]], {
    message: 'Prosím vyberte platný predmet',
  }),
  message: z.string().min(1, 'Správa je povinná').min(10, 'Správa musí mať aspoň 10 znakov'),
  // Honeypot field - should always be empty for real users
  website: z.string().optional(),
})

export type ContactFormData = z.infer<typeof contactFormSchema>

// Utility function to get the display label for a reason value
export function getReasonLabel(reason: string): string {
  const option = REASON_OPTIONS.find((option) => option.value === reason)
  return option?.label || reason
}
