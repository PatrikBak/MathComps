/**
 * Verification email templates for Clerk authentication
 */

import { getTranslations } from 'next-intl/server'

import type { Locale } from '@/i18n/i18n'

import { generateBaseEmail, generateCodeBox, generateInfoBox } from './base-template'

/**
 * Props for email verification (used in both signup and password reset)
 */
type VerificationEmailProps = {
  /** The verification code */
  code: string
  /** The recipient's email address */
  email: string
  /** Locale for email content */
  locale: Locale
}

/**
 * Generates HTML for signup verification code email
 */
export async function generateSignupVerificationEmail({
  code,
  email,
  locale,
}: VerificationEmailProps): Promise<string> {
  // Get translations for the email content
  const t = await getTranslations({ locale, namespace: 'email.signup' })

  // Generate the email content
  const content = `
    <h2 style="margin: 0 0 16px; color: #1d1d1f; font-size: 24px; font-weight: 600;">
      ${t('title')}
    </h2>
    
    <p style="margin: 0 0 24px; color: #6e6e73; font-size: 16px; line-height: 1.6;">
      ${t('description')}
    </p>
    
    ${generateCodeBox(code)}
    
    <p style="margin: 24px 0 0; color: #6e6e73; font-size: 14px; line-height: 1.5;">
      ${t.raw('validity')} ${t('ignore')}
    </p>
    
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e5e7;">
      <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
        ${t('registrationFor')} <strong style="color: #6e6e73;">${email}</strong>
      </p>
    </div>
  `

  // Generate the email using the common template
  return generateBaseEmail(content, t('previewText'), locale)
}

/**
 * Generates HTML for password reset verification code email
 */
export async function generatePasswordResetEmail({
  code,
  email,
  locale,
}: VerificationEmailProps): Promise<string> {
  // Get translations for the email content
  const t = await getTranslations({ locale, namespace: 'email.passwordReset' })

  // Generate the email content
  const content = `
    <h2 style="margin: 0 0 16px; color: #1d1d1f; font-size: 24px; font-weight: 600;">
      ${t('title')}
    </h2>
    
    <p style="margin: 0 0 24px; color: #6e6e73; font-size: 16px; line-height: 1.6;">
      ${t('description')}
    </p>
    
    ${generateCodeBox(code)}
    
    <p style="margin: 24px 0 0; color: #6e6e73; font-size: 14px; line-height: 1.5;">
      ${t.raw('validity')} ${t('ignore')}
    </p>
    
    ${generateInfoBox(t.raw('warning'), 'warning')}
    
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e5e7;">
      <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
        ${t('requestFor')} <strong style="color: #6e6e73;">${email}</strong>
      </p>
    </div>
  `

  // Generate the email using the common template
  return generateBaseEmail(content, t('previewText'), locale)
}
