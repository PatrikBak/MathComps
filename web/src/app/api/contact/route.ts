import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { getReasonLabelForAdmin } from '@/components/features/contact/contact-reasons'
import { baseContactFormSchema } from '@/components/features/contact/contact-schema'
import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { ApiError, withApiHandler } from '@/lib/api/api-handler'
import { sendEmail } from '@/lib/email/email-sender'
import { generateContactEmail } from '@/lib/email/notification-emails'

/**
 * Detects a tripped honeypot, the signal of a likely bot.
 *
 * @param body - The raw request body
 *
 * @returns Whether the submission looks like a bot
 */
function isLikelyBot(body: Record<string, unknown>): boolean {
  // A filled hidden honeypot field means a bot
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

  // Build the notification email HTML
  const emailHtml = await generateContactEmail({
    name: validatedData.name,
    email: validatedData.email,
    reason: reasonLabel,
    message: validatedData.message,
  })

  // Resolve the contact inbox address
  const sendEmailTo = getRequiredEnv('NEXT_PUBLIC_CONTACT_EMAIL')

  // Send the notification email
  const result = await sendEmail({
    to: sendEmailTo,
    replyTo: validatedData.email,
    subject: `New MathComps message: ${reasonLabel}`,
    html: emailHtml,
  })

  // Surface a send failure as a coded server error; the provider's message never reaches the user
  if (!result.success) {
    throw new ApiError(502, 'SERVER_ERROR')
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
