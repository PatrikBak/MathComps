import { Resend } from 'resend'

import { getOptionalEnv, getRequiredEnv } from '@/components/shared/utils/env-utils'

/**
 * Options for sending an email via Resend
 */
type SendEmailOptions = {
  /** Recipient email address(es) */
  to: string | string[]
  /** Email subject line */
  subject: string
  /** HTML content of the email */
  html: string
  /** Optional reply-to email address */
  replyTo?: string
}

/**
 * Result of a successful email send operation
 */
type SendEmailSuccess = {
  /** Whether the email was sent successfully */
  success: true
  /** ID of the sent email */
  emailId: string | undefined
  /** Whether the email was sent in development mode */
  development?: boolean
}

/**
 * Result of a failed email send operation
 */
type SendEmailError = {
  /** Whether the email was sent successfully */
  success: false
  /** Error message */
  error: string
  /** HTTP status code */
  statusCode: number
}

/**
 * Result of an email send operation
 */
type SendEmailResult = SendEmailSuccess | SendEmailError

/**
 * Sends an email using Resend API with comprehensive error handling.
 *
 * In development mode without an API key, this function will log the email
 * details to the console instead of sending an actual email.
 *
 * @param options - Email sending options
 *
 * @returns Promise resolving to the result of the email send operation
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // Check for the resend API key
    const resendApiKey = getOptionalEnv('RESEND_API_KEY')

    // If we're in development mode and the API key is not configured...
    if (process.env.NODE_ENV === 'development' && resendApiKey === undefined) {
      // ...we'll mock the email
      console.log('Development mode: Mock email sent (no API key configured)')
      console.log('Email details:', {
        to: options.to,
        subject: options.subject,
        replyTo: options.replyTo,
      })

      // Mocking works out fine
      return {
        success: true,
        emailId: 'mock-email-id',
        development: true,
      }
    }

    // Initialize Resend with the API key
    const resend = new Resend(resendApiKey)

    // The email sender will be the contact email
    const senderEmail = getRequiredEnv('CONTACT_EMAIL')

    // Send email using Resend, as from the contact email
    const { data, error } = await resend.emails.send({
      from: `MathComps <${senderEmail}>`,
      to: Array.isArray(options.to) ? options.to : [options.to],
      replyTo: options.replyTo,
      subject: options.subject,
      html: options.html,
    })

    // Handle errors
    if (error) {
      return {
        success: false,
        error: `Resend error: ${error.message}`,
        statusCode: 500,
      }
    }

    // Handle success (that's not always easy?)
    return {
      success: true,
      emailId: data?.id,
    }
  } catch (error) {
    // Handle generic errors
    console.error('Email sending error:', error)

    // Return error response
    return {
      success: false,
      error: `Unknown error while sending email${error instanceof Error ? ` (${error.message})` : ''}`,
      statusCode: 500,
    }
  }
}
