/**
 * Verification email templates for Clerk authentication
 * Uses base template system for consistent branding
 */

import { generateBaseEmail, generateCodeBox, generateInfoBox } from './base-template'

/**
 * Props for verification email
 */
type VerificationEmailProps = {
  /** The verification code */
  code: string
  /** The recipient's email address */
  email: string
}

/**
 * Generates HTML for signup verification code email
 */
export function generateSignupVerificationEmail({ code, email }: VerificationEmailProps): string {
  const content = `
    <h2 style="margin: 0 0 16px; color: #1d1d1f; font-size: 24px; font-weight: 600;">
      Vitajte v MathComps! 🎉
    </h2>
    
    <p style="margin: 0 0 24px; color: #6e6e73; font-size: 16px; line-height: 1.6;">
      Pre dokončenie registrácie použite tento overovací kód:
    </p>
    
    ${generateCodeBox(code)}
    
    <p style="margin: 24px 0 0; color: #6e6e73; font-size: 14px; line-height: 1.5;">
      Tento kód je platný <strong>10 minút</strong>. Ak ste nevytvárali účet na MathComps, tento email ignorujte.
    </p>
    
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e5e7;">
      <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
        Registrácia pre: <strong style="color: #6e6e73;">${email}</strong>
      </p>
    </div>
  `

  // Reuse the base email template
  return generateBaseEmail({
    content,
    previewText: 'Vitajte v MathComps! Dokončte svoju registráciu.',
  })
}

/**
 * Generates HTML for password reset verification code email
 */
export function generatePasswordResetEmail({ code, email }: VerificationEmailProps): string {
  const content = `
    <h2 style="margin: 0 0 16px; color: #1d1d1f; font-size: 24px; font-weight: 600;">
      Obnovenie hesla 🔐
    </h2>
    
    <p style="margin: 0 0 24px; color: #6e6e73; font-size: 16px; line-height: 1.6;">
      Dostali sme požiadavku na obnovenie hesla pre váš MathComps účet. Pre pokračovanie použite tento overovací kód:
    </p>
    
    ${generateCodeBox(code)}
    
    <p style="margin: 24px 0 0; color: #6e6e73; font-size: 14px; line-height: 1.5;">
      Tento kód je platný <strong>10 minút</strong>. Ak ste nepožiadali o obnovenie hesla, tento email ignorujte a vaše heslo zostane nezmenené.
    </p>
    
    ${generateInfoBox({
      type: 'warning',
      content: '<strong>⚠️ Ak ste o obnovenie hesla nežiadali, tento email ignorujte.</strong>',
    })}
    
    <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #e5e5e7;">
      <p style="margin: 0; color: #86868b; font-size: 13px; line-height: 1.5;">
        Požiadavka pre: <strong style="color: #6e6e73;">${email}</strong>
      </p>
    </div>
  `

  // Reuse the base email template
  return generateBaseEmail({
    content,
    previewText: 'Obnovenie hesla pre váš MathComps účet',
  })
}
