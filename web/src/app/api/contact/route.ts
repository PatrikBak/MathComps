import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

import { contactFormSchema, getReasonLabel } from '@/components/features/contact/contactFormSchema'
import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { generateContactEmail } from '@/lib/email/notification-emails'

// Honeypot field to catch bots
function isLikelyBot(body: Record<string, unknown>): boolean {
  // If the hidden honeypot field is filled, it's a bot
  return body.website !== undefined && body.website !== ''
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Basic bot detection
    if (isLikelyBot(body)) {
      // Return success to avoid revealing the honeypot
      return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 })
    }

    // Validate the form data
    const validatedData = contactFormSchema.parse(body)

    // Check for development mode with missing API key first
    const resendApiKey = process.env.RESEND_API_KEY
    if (process.env.NODE_ENV === 'development' && (!resendApiKey || resendApiKey.trim() === '')) {
      console.log('Development mode: Mock email sent (no API key configured)')
      console.log('Contact form data:', {
        name: validatedData.name,
        email: validatedData.email,
        reason: getReasonLabel(validatedData.reason),
        message: validatedData.message,
      })

      return NextResponse.json(
        {
          message: 'Development mode - no actual email sent',
          emailId: 'mock-email-id',
          development: true,
        },
        { status: 200 }
      )
    }

    // Get required environment variables for production
    const contactEmail = getRequiredEnv('CONTACT_EMAIL')
    const senderEmail = getRequiredEnv('SENDER_EMAIL')

    // Generate email HTML using unified template
    const emailHtml = generateContactEmail({
      name: validatedData.name,
      email: validatedData.email,
      reason: getReasonLabel(validatedData.reason),
      message: validatedData.message,
    })

    // Initialize Resend with the API key
    const resend = new Resend(resendApiKey)

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `MathComps <${senderEmail}>`,
      to: [contactEmail],
      replyTo: validatedData.email,
      subject: `Nová správa z MathComps: ${getReasonLabel(validatedData.reason)}`,
      html: emailHtml,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: 'Nepodarilo sa odoslať email' }, { status: 500 })
    }

    return NextResponse.json(
      {
        message: 'Email sent successfully',
        emailId: data?.id,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Contact form error:', error)

    // Handle validation errors
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: 'Neplatné údaje vo formulári' }, { status: 400 })
    }

    // Handle missing environment variables
    if (
      error instanceof Error &&
      error.message.includes('environment variable is not configured')
    ) {
      const isDevelopment = process.env.NODE_ENV === 'development'
      const errorMessage = isDevelopment
        ? `Configuration error: ${error.message}. Please check your .env file.`
        : 'Služba je dočasne nedostupná'

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    // Handle Resend API errors
    if (error instanceof Error && error.message.includes('Resend')) {
      const isDevelopment = process.env.NODE_ENV === 'development'
      const errorMessage = isDevelopment
        ? `Email service error: ${error.message}`
        : 'Nepodarilo sa odoslať email'

      return NextResponse.json({ error: errorMessage }, { status: 500 })
    }

    // Generic error handling
    const isDevelopment = process.env.NODE_ENV === 'development'
    const errorMessage = isDevelopment
      ? `Server error: ${error instanceof Error ? error.message : 'Unknown error'}`
      : 'Chyba servera'

    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
