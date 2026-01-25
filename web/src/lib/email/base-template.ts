/**
 * Base email template system for MathComps
 */

import { getTranslations } from 'next-intl/server'

import { getRequiredEnv } from '@/components/shared/utils/env-utils'
import { type Locale, ROUTES } from '@/i18n/i18n'

/**
 * Generates the common email header with MathComps branding
 *
 * @returns HTML string of the email header
 */
function generateEmailHeader(): string {
  // Get the site URL so we can use it to load the logo + make the logo clickable
  const siteUrl = getRequiredEnv('NEXT_PUBLIC_SITE_URL')

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 32px 40px; text-align: center; background-color: #1e1b4b; border-radius: 12px 12px 0 0;">
          <!--[if mso]>
          <table role="presentation" width="100%">
            <tr>
              <td align="center">
          <![endif]-->
          <a href="${siteUrl}" style="text-decoration: none; display: inline-block;">
            <div style="display: inline-block; vertical-align: middle;">
              <img 
                src="${siteUrl}/logo-mathcomps.png" 
                alt="MathComps"
                style="display: inline-block; vertical-align: middle; width: 32px; height: 32px; margin-right: 12px;"
              />
              <span style="display: inline-block; vertical-align: middle; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                <span style="color: #ffffff;">Math</span><span style="color: #a78bfa;">Comps</span>
              </span>
            </div>
          </a>
          <!--[if mso]>
              </td>
            </tr>
          </table>
          <![endif]-->
        </td>
      </tr>
    </table>
  `
}

/**
 * Generates the common email footer
 *
 * @param locale - The locale for the footer
 *
 * @returns HTML string of the email footer
 */
async function generateEmailFooter(locale: Locale): Promise<string> {
  // Get translations for the footer
  const t = await getTranslations({ locale, namespace: 'email.footer' })

  // Construct the privacy policy URL
  const privacyUrl = `${getRequiredEnv('NEXT_PUBLIC_SITE_URL')}${ROUTES.PRIVACY}`

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td style="padding: 32px 40px; text-align: center; background-color: #1e1b4b; border-radius: 0 0 12px 12px; color: #94a3b8; font-size: 14px; line-height: 1.5;">
          
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 14px;">
            MathComps • © 2025 • Patrik Bak
          </p>
          
          <div>
             <a href="${privacyUrl}" style="color: #94a3b8; text-decoration: underline; font-size: 14px;">${t('privacy')}</a>
          </div>
        </td>
      </tr>
    </table>
  `
}

/**
 * Base email template wrapper. Wraps content with consistent header, footer, and styling.
 *
 * @param content - Main content HTML to insert into the template
 * @param previewText - Email subject for preview text
 * @param locale - Locale for footer text
 *
 * @returns HTML string of the email template
 */
export async function generateBaseEmail(
  content: string,
  previewText: string,
  locale: Locale
): Promise<string> {
  return `
    <!DOCTYPE html>
    <html lang="${locale}">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      ${previewText ? `<meta name="description" content="${previewText}">` : ''}
      <title>MathComps</title>
      <!--[if mso]>
      <style type="text/css">
        body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
      </style>
      <![endif]-->
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
      ${previewText ? `<div style="display: none; max-height: 0; overflow: hidden;">${previewText}</div>` : ''}
      
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f5f5f7;">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
              
              ${generateEmailHeader()}
              
              <!-- Main Content -->
              <tr>
                <td style="padding: 40px;">
                  ${content}
                </td>
              </tr>
              
              ${await generateEmailFooter(locale)}
              
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Helper to create a verification code display box
 *
 * @param code - The verification code to display
 *
 * @returns HTML string of the verification code display box
 */
export function generateCodeBox(code: string): string {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
      <tr>
        <td align="center" style="padding: 24px 0;">
          <div style="display: inline-block; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px 40px; border-radius: 8px;">
            <span style="color: #0f172a; font-size: 32px; font-weight: 700; letter-spacing: 8px; font-family: 'Courier New', Consolas, monospace;">
              ${code}
            </span>
          </div>
        </td>
      </tr>
    </table>
  `
}

/**
 * Helper to create an info box with optional styling
 *
 * @param content - The content of the info box
 * @param type - The type of the info box
 *
 * @returns HTML string of the info box
 */
export function generateInfoBox(
  content: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info'
): string {
  // Get the style object based on the type
  const style = {
    info: {
      bg: '#eff6ff',
      border: '#3b82f6',
      text: '#1e40af',
    },
    success: {
      bg: '#f0fdf4',
      border: '#22c55e',
      text: '#166534',
    },
    warning: {
      bg: '#fff8e6',
      border: '#f59e0b',
      text: '#92400e',
    },
    error: {
      bg: '#fef2f2',
      border: '#ef4444',
      text: '#991b1b',
    },
  }[type]

  // Return the info box HTML
  return `
    <div style="margin-top: 24px; padding: 20px; background-color: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 4px;">
      <p style="margin: 0; color: ${style.text}; font-size: 14px; line-height: 1.5;">
        ${content}
      </p>
    </div>
  `
}
