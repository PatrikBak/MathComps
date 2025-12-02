/**
 * Notification email templates for user communications
 * Uses base template system for consistent branding
 */

import { generateBaseEmail } from './base-template'

/**
 * Props for contact email
 */
type ContactEmailProps = {
  /** The name of the person who sent the email */
  name: string
  /** The email address of the person who sent the email */
  email: string
  /** The reason for the contact */
  reason: string
  /** The message sent by the person */
  message: string
}

/**
 * Generates HTML for contact form notification email
 */
export function generateContactEmail({ name, email, reason, message }: ContactEmailProps): string {
  const content = `
    <h2 style="margin: 0 0 16px; color: #1d1d1f; font-size: 24px; font-weight: 600; border-bottom: 2px solid #667eea; padding-bottom: 12px;">
      Nová správa z kontaktného formulára
    </h2>
    
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
      <h3 style="color: #334155; margin: 0 0 16px; font-size: 16px; font-weight: 600;">
        Kontaktné údaje
      </h3>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: #64748b; font-size: 14px;">
              <strong>Meno:</strong>
            </span>
          </td>
          <td style="padding: 4px 0;">
            <span style="color: #1e293b; font-size: 14px;">
              ${name}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: #64748b; font-size: 14px;">
              <strong>Email:</strong>
            </span>
          </td>
          <td style="padding: 4px 0;">
            <span style="color: #1e293b; font-size: 14px;">
              ${email}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 4px 0;">
            <span style="color: #64748b; font-size: 14px;">
              <strong>Dôvod:</strong>
            </span>
          </td>
          <td style="padding: 4px 0;">
            <span style="color: #1e293b; font-size: 14px;">
              ${reason}
            </span>
          </td>
        </tr>
      </table>
    </div>
    
    <div style="background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin-top: 24px;">
      <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #475569; font-size: 14px;">${message}</p>
    </div>
  `

  // Reuse the base email template
  return generateBaseEmail({
    content,
    previewText: `Nová správa od ${name}: ${reason}`,
  })
}
