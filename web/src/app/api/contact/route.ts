import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { contactFormSchema, getReasonLabel } from '@/components/features/contact/contactFormSchema'
import { getRequiredEnv } from '@/components/shared/utils/env-utils'
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
export async function POST(request: NextRequest) {
  try {
    // Parse the request body
    const body = await request.json()

    // Basic bot detection
    if (isLikelyBot(body)) {
      // Return success to avoid revealing the honeypot
      return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 })
    }

    // Validate the form data
    const validatedData = contactFormSchema.parse(body)

    // Generate email HTML using unified template
    const emailHtml = generateContactEmail({
      name: validatedData.name,
      email: validatedData.email,
      reason: getReasonLabel(validatedData.reason),
      message: validatedData.message,
    })

    // The form is send to the contact email
    const sendEmailTo = getRequiredEnv('CONTACT_EMAIL')

    // Send email using shared utility to the contact email
    const result = await sendEmail({
      to: sendEmailTo,
      replyTo: validatedData.email,
      subject: `Nová správa z MathComps: ${getReasonLabel(validatedData.reason)}`,
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
  } catch (error) {
    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Neplatné údaje vo formulári' }, { status: 400 })
    }

    // Generic error handling
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === 'development'
            ? `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`
            : 'Chyba servera',
      },
      { status: 500 }
    )
  }
}
