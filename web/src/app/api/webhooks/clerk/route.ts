import { headers } from 'next/headers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getTranslations } from 'next-intl/server'
import { Webhook } from 'svix'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/i18n'
import { ApiError, withApiHandler } from '@/lib/api/api-handler'
import { sendEmail } from '@/lib/email/email-sender'
import {
  generatePasswordResetEmail,
  generateSignupVerificationEmail,
} from '@/lib/email/verification-emails'
import { reportError } from '@/lib/error-reporting/report-error'
import type { ClerkWebhookEvent } from '@/types/clerk-webhook'
import { isEmailCreatedEvent } from '@/types/clerk-webhook'

/**
 * Handles Clerk webhooks. We will handle email.created events which
 * send verification code for either registration or password reset. No
 * unnecessary spam 🥳
 *
 * Wrapped so a missing secret or a failing send returns a structured, reported error and svix can retry.
 * It speaks the same JSON error contract every other route does.
 */
export const POST = withApiHandler(async (request: NextRequest) => {
  // Get webhook secret from environment
  const webhookSecret = getRequiredEnv('CLERK_WEBHOOK_SECRET')

  // Get request body and svix headers
  const payload = await request.text()
  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  // Ensure all required headers are present
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new ApiError(400, 'VALIDATION_FAILED')
  }

  // We need to parse out the webhook event
  let event: ClerkWebhookEvent

  try {
    // Verify the webhook signature
    event = new Webhook(webhookSecret).verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (error) {
    // A bad signature is most likely a signing secret changed at Clerk's end, and then nobody gets
    // their code, so it is reported
    reportError(error)

    // Bad signature / event format
    throw new ApiError(400, 'VALIDATION_FAILED')
  }

  // Handle email.created events only
  if (!isEmailCreatedEvent(event)) {
    return NextResponse.json({ message: 'Event ignored' }, { status: 200 })
  }

  // Get the recipient email address
  const recipientEmail = event.data.to_email_address

  // Default locale for emails (one day will be extended to detect user's preferred locale)
  const locale: Locale = DEFAULT_LOCALE

  // Get translations for email subjects
  const tEmail = await getTranslations({ locale, namespace: 'email' })

  // We'll generate the appropriate email template
  let generateEmail: typeof generateSignupVerificationEmail
  let subject: string

  // This is what distinguishes the email type
  switch (event.data.slug) {
    case 'verification_code':
      generateEmail = generateSignupVerificationEmail
      subject = tEmail('signup.subject')
      break
    case 'reset_password_code':
      generateEmail = generatePasswordResetEmail
      subject = tEmail('passwordReset.subject')
      break

    // Clerk hands every other mail here too, and those notifications are ones we choose not to send 🙃
    default:
      return NextResponse.json({ message: 'Email type ignored' }, { status: 200 })
  }

  // Try to extract the verification code from body
  // We look for a standalone 6-digit number using regex word boundaries
  // This approach is trully wonderful, what can I say? I wish I didn't choose Clerk
  const code = event.data.body?.match(/\b\d{6}\b/)?.[0]

  // A sign-up or reset mail without its code leaves the reader unable to finish, so it is a server error
  if (!code) {
    throw new ApiError(500, 'SERVER_ERROR')
  }

  // The mail itself, carrying the code
  const emailHtml = await generateEmail({ code, email: recipientEmail, locale })

  // Send email using shared utility
  const result = await sendEmail({
    to: recipientEmail,
    subject,
    html: emailHtml,
  })

  // A failed send is a server-side error; throwing lets svix retry and reports it
  if (!result.success) {
    throw new ApiError(502, 'SERVER_ERROR')
  }

  // If no error, we managed to send the email correctly
  return NextResponse.json(
    {
      message: 'Email sent successfully',
      emailId: result.emailId,
    },
    { status: 200 }
  )
})
