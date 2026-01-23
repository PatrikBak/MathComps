import { type useTranslations } from 'next-intl'
import { z, type ZodRawShape } from 'zod'

import type { AuthScreenWithValidation } from './AuthForm'

/**
 * Type for the validation translation function.
 */
type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>

/**
 * Creates base schemas for email validation.
 */
const createEmailSchema = (t: ValidationTranslator) => z.email(t('invalidEmail'))

/**
 * Creates base schema for password validation.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema for the password
 */
const createPasswordSchema = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('passwordRequired'))
    .min(8, t('passwordMinLength', { count: 8 }))

/**
 * Creates base schema for password confirmation.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema for the password confirmation
 */
const createConfirmPasswordSchema = (t: ValidationTranslator) =>
  z.string().min(1, t('confirmPasswordRequired'))

/**
 * Creates schema for display name validation.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema for the display name
 */
export const createDisplayNameSchema = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('nameRequired'))
    .min(3, t('nameMinLength', { count: 3 }))
    .max(20, t('nameMaxLength', { count: 20 }))

/**
 * Creates base schema for verification code validation.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema for the verification code
 */
const createCodeSchema = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('codeRequired'))
    .length(6, t('codeLength', { count: 6 }))

/**
 * Helper to add password matching refinement to a schema.
 *
 * @param schema - The schema to add the refinement to
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns The schema with the refinement added
 */
const addPasswordMatchRefinement = <T extends z.ZodObject<ZodRawShape>>(
  schema: T,
  t: ValidationTranslator
) =>
  schema.refine((data) => data.password === data.confirmPassword, {
    message: t('passwordsDoNotMatch'),
    path: ['confirmPassword'],
  })

/**
 * Creates all auth-related schemas with translated validation messages.
 *
 * @param t - The translation function from useTranslations('validation')
 *
 * @returns Object containing all auth schemas
 */
export function createAuthSchemas(t: ValidationTranslator) {
  // Create schemas requiring translation
  const emailSchema = createEmailSchema(t)
  const passwordSchema = createPasswordSchema(t)
  const confirmPasswordSchema = createConfirmPasswordSchema(t)
  const displayNameSchema = createDisplayNameSchema(t)
  const codeSchema = createCodeSchema(t)

  // Schema for login form
  const loginSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
  })

  // Schema for password reset form (only requires email)
  const checkEmailSchema = z.object({
    email: emailSchema,
  })

  // Schema for code verification
  const codeVerificationSchema = z.object({
    code: codeSchema,
  })

  // Schema for signup form
  const signupSchema = addPasswordMatchRefinement(
    z.object({
      firstName: displayNameSchema,
      email: emailSchema,
      password: passwordSchema,
      confirmPassword: confirmPasswordSchema,
    }),
    t
  )

  // Schema for new password entry
  const newPasswordSchema = addPasswordMatchRefinement(
    z.object({
      password: passwordSchema,
      confirmPassword: confirmPasswordSchema,
    }),
    t
  )

  // Return all schemas
  return {
    loginSchema,
    checkEmailSchema,
    codeVerificationSchema,
    signupSchema,
    newPasswordSchema,
  }
}

/**
 * Type for the schemas returned by createAuthSchemas.
 */
type AuthSchemas = ReturnType<typeof createAuthSchemas>

/**
 * Type inference for email entry form data.
 */
export type EnterEmailFormData = z.infer<AuthSchemas['checkEmailSchema']>

/**
 * Type inference for login form data.
 */
export type LoginFormData = z.infer<AuthSchemas['loginSchema']>

/**
 * Type inference for signup form data.
 */
export type SignupFormData = z.infer<AuthSchemas['signupSchema']>

/**
 * Type inference for password reset form data.
 */
export type ResetPasswordFormData = z.infer<AuthSchemas['checkEmailSchema']>

/**
 * Type inference for reset code form data.
 */
export type ResetCodeFormData = z.infer<AuthSchemas['codeVerificationSchema']>

/**
 * Type inference for email verification form data.
 */
export type EmailVerificationFormData = z.infer<AuthSchemas['codeVerificationSchema']>

/**
 * Type inference for new password form data.
 */
export type NewPasswordFormData = z.infer<AuthSchemas['newPasswordSchema']>

/**
 * Union type for all form data types.
 */
export type AuthFormValues =
  | EnterEmailFormData
  | LoginFormData
  | SignupFormData
  | ResetPasswordFormData
  | ResetCodeFormData
  | NewPasswordFormData
  | EmailVerificationFormData

/**
 * Get the appropriate schema based on the authentication screen.
 *
 * @param schemas - The auth schemas created with createAuthSchemas
 * @param screen - The current authentication screen
 *
 * @returns The Zod schema for the given screen
 */
export function getAuthSchema(schemas: AuthSchemas, screen: AuthScreenWithValidation) {
  switch (screen) {
    case 'forgotten-password':
    case 'enter-email':
      return schemas.checkEmailSchema
    case 'password-reset-code':
    case 'email-verification':
      return schemas.codeVerificationSchema
    case 'enter-new-password':
      return schemas.newPasswordSchema
    case 'signup-with-email':
      return schemas.signupSchema
    case 'login-with-email':
      return schemas.loginSchema
  }
}
