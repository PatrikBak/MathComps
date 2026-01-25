import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  baseContactFormSchema,
  getReasonLabelForAdmin,
} from '@/components/features/contact/contactFormSchema'
import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { withApiHandler } from '@/lib/api/api-handler'
import { sendEmail } from '@/lib/email/email-sender'
import { generateContactEmail } from '@/lib/email/notification-emails'

// Honeypot field to catch bots
function isLikelyBot(body: Record<string, unknown>): boolean {
  // If the hidden honeypot field is filled, it's a bot
  return body.website !== undefined && body.website !== ''
}

/**
 * Handles contact form submissions.
 * Validates the form data, sends an email notification, and returns a response.
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  // Parse the request body
  const body = await request.json()

  // Basic bot detection
  if (isLikelyBot(body)) {
    // Return success to avoid revealing the honeypot
    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 })
  }

  // Validate the form data (ZodError is handled by withApiHandler)
  const validatedData = baseContactFormSchema.parse(body)

  // Get translated reason label (in English for admin)
  const reasonLabel = await getReasonLabelForAdmin(validatedData.reason)

  // Generate email HTML using unified template
  const emailHtml = await generateContactEmail({
    name: validatedData.name,
    email: validatedData.email,
    reason: reasonLabel,
    message: validatedData.message,
  })

  // The form is send to the contact email
  const sendEmailTo = getRequiredEnv('NEXT_PUBLIC_CONTACT_EMAIL')

  // Send email using shared utility to the contact email
  const result = await sendEmail({
    to: sendEmailTo,
    replyTo: validatedData.email,
    subject: `New MathComps message: ${reasonLabel}`,
    html: emailHtml,
  })

  // Handle errors
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.statusCode })
  }

  // Return success response
  return NextResponse.json(
    {
      message: 'Email sent successfully',
      emailId: result.emailId,
      ...(result.development && { development: true }),
    },
    { status: 200 }
  )
})
