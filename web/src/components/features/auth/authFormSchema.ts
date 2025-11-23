import { z, type ZodRawShape } from 'zod'

import type { AuthScreenWithValidation } from './AuthForm'

/**
 * Base schema for email validation used across all auth screens.
 */
const emailSchema = z.email('Zadajte platný email')

/**
 * Base schema for password validation.
 */
const passwordSchema = z.string().min(1, 'Heslo je povinné').min(8, 'Heslo musí mať aspoň 8 znakov')

/**
 * Base schema for password confirmation.
 */
const confirmPasswordSchema = z.string().min(1, 'Potvrdenie hesla je povinné')

/**
 * Base schema for user name validation.
 */
const nameSchema = z.string().min(1, 'Meno je povinné').min(2, 'Meno musí mať aspoň 2 znaky')

/**
 * Base schema for verification code validation.
 */
const codeSchema = z.string().min(1, 'Kód je povinný').length(6, 'Kód musí mať 6 znakov')

/**
 * Schema for login form (requires email and password).
 */
const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

/**
 * Schema for password reset form (only requires email).
 */
const checkEmailSchema = z.object({
  email: emailSchema,
})

/**
 * Schema for code verification (requires code).
 */
const codeVerificationSchema = z.object({
  code: codeSchema,
})

/**
 * Helper to add password matching refinement to a schema.
 */
const addPasswordMatchRefinement = <T extends z.ZodObject<ZodRawShape>>(schema: T) =>
  schema.refine((data) => data.password === data.confirmPassword, {
    message: 'Heslá sa nezhodujú',
    path: ['confirmPassword'],
  })

/**
 * Schema for signup form (requires name, email, password, and confirmPassword).
 */
const signupSchema = addPasswordMatchRefinement(
  z.object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
)

/**
 * Schema for new password entry (requires password and confirmPassword).
 */
const newPasswordSchema = addPasswordMatchRefinement(
  z.object({
    password: passwordSchema,
    confirmPassword: confirmPasswordSchema,
  })
)

/**
 * Type inference for email entry form data.
 */
export type EnterEmailFormData = z.infer<typeof checkEmailSchema>

/**
 * Type inference for login form data.
 */
export type LoginFormData = z.infer<typeof loginSchema>

/**
 * Type inference for signup form data.
 */
export type SignupFormData = z.infer<typeof signupSchema>

/**
 * Type inference for password reset form data.
 */
export type ResetPasswordFormData = z.infer<typeof checkEmailSchema>

/**
 * Type inference for reset code form data.
 */
export type ResetCodeFormData = z.infer<typeof codeVerificationSchema>

/**
 * Type inference for email verification form data.
 */
export type EmailVerificationFormData = z.infer<typeof codeVerificationSchema>

/**
 * Type inference for new password form data.
 */
export type NewPasswordFormData = z.infer<typeof newPasswordSchema>

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
 * @param screen - The current authentication screen
 *
 * @returns The Zod schema for the given screen
 */
export function getAuthSchema(screen: AuthScreenWithValidation) {
  switch (screen) {
    case 'forgotten-password':
    case 'enter-email':
      return checkEmailSchema
    case 'password-reset-code':
    case 'email-verification':
      return codeVerificationSchema
    case 'enter-new-password':
      return newPasswordSchema
    case 'signup-with-email':
      return signupSchema
    case 'login-with-email':
      return loginSchema
  }
}
