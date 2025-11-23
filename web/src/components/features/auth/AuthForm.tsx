'use client'

import { useSignIn, useSignUp, useUser } from '@clerk/nextjs'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'

import { LoadingSpinner } from '@/components/shared/components/LoadingSpinner'
import { ROUTES } from '@/constants/routes'

import { checkEmailExists } from './actions'
import AuthFormActions from './AuthFormActions'
import AuthFormFields from './AuthFormFields'
import AuthFormHeader from './AuthFormHeader'
import {
  type AuthFormValues,
  type EmailVerificationFormData,
  type EnterEmailFormData,
  getAuthSchema,
  type LoginFormData,
  type NewPasswordFormData,
  type ResetCodeFormData,
  type ResetPasswordFormData,
  type SignupFormData,
} from './authFormSchema'
import AuthHubScreen from './AuthHubScreen'
import AuthMessage from './AuthMessage'

/**
 * Possible authentication screens.
 */
export type AuthScreen =
  | 'hub'
  | 'login-with-email'
  | 'signup-with-email'
  | 'forgotten-password'
  | 'password-reset-code'
  | 'enter-new-password'
  | 'enter-email'
  | 'email-verification'

/**
 * Authentication screens that require validation.
 */
export type AuthScreenWithValidation = Exclude<AuthScreen, 'hub'>

/**
 * Structure of error objects returned by Clerk API.
 */
type ClerkErrorPayload = {
  /** Error code identifying the specific type of error */
  code?: string
  /** Human-readable error message */
  message?: string
  /** Array of detailed error objects, each with its own code and message */
  errors?: Array<{ code?: string; message?: string }>
}

/**
 * Extracts the error code and message from a Clerk error object.
 *
 * @param error - The error object to extract details from
 *
 * @returns An object containing the error code and message
 */
const getClerkErrorDetails = (error: unknown) => {
  // Expect a Clerk error payload
  const clerkErrorPayload = error as ClerkErrorPayload

  // Take just the first error
  const firstError = clerkErrorPayload.errors?.[0]

  // Return the error code and message or some defaults
  return {
    code: firstError?.code || clerkErrorPayload.code,
    message: firstError?.message || clerkErrorPayload.message || '',
  }
}

/**
 * Main authentication form component handling the new hub-based flow.
 * Flow: Hub -> Email Entry -> Login/Signup (determined by email check)
 */
export default function AuthForm() {
  // State for current authentication screen
  const [screen, setScreen] = useState<AuthScreen>('hub')
  // State for global error messages to display to the user
  const [globalError, setGlobalError] = useState('')
  // State for success messages (e.g. after password reset)
  const [successMessage, setSuccessMessage] = useState('')
  // State to track loading status during async operations
  const [loading, setLoading] = useState(false)
  // State to store the email entered in the initial step
  const [enteredEmail, setEnteredEmail] = useState<string>('')
  // State to store the URL to redirect to after successful authentication
  const [returnUrl, setReturnUrl] = useState<string | null>(null)

  // Next.js router for navigation
  const router = useRouter()
  // Search params to get return URL from query string
  const searchParams = useSearchParams()
  // Clerk hook for sign-in operations
  const { signIn, setActive: setActiveSignIn } = useSignIn()
  // Clerk hook for sign-up operations
  const { signUp, setActive: setActiveSignUp } = useSignUp()
  // Clerk hook to get current user data
  const { user, isLoaded: isUserLoaded } = useUser()

  // React Hook Form setup with Zod validation schema based on current screen
  const methods = useForm<AuthFormValues>({
    // Hub screen doesn't require validation
    resolver: screen === 'hub' ? undefined : zodResolver(getAuthSchema(screen)),
    // This will validat on submit and then watch for changes
    mode: 'onSubmit',
  })

  // Redirect logged-in users to profile page
  useEffect(() => {
    // Do the redirect only if the user is loaded and logged in
    if (isUserLoaded && user) {
      router.push(ROUTES.PROFILE)
    }
  }, [isUserLoaded, user, router])

  // Capture return URL on mount - from query param, referrer, or default to home
  useEffect(() => {
    // Get return URL from query param or referrer
    const urlParam = searchParams.get('returnUrl') || searchParams.get('redirect')
    const referrer = typeof window !== 'undefined' ? document.referrer : null

    // Determines the return URL based on query params, referrer, or defaults to home.
    setReturnUrl(
      (() => {
        // Prefer query param if available
        if (urlParam) {
          return urlParam
        }

        // Check referrer if it's not the auth page itself
        if (referrer && !referrer.includes(ROUTES.LOGIN)) {
          try {
            // Reconstruct the referrer URL
            const referrerUrl = new URL(referrer)

            // Only use referrer if it's from the same origin
            if (referrerUrl.origin === window.location.origin) {
              // Remove any query parameters that might have been added by Clerk
              return referrerUrl.pathname + referrerUrl.search
            }
          } catch {
            // Invalid URL, fall through to default
          }
        }

        // Default to home
        return ROUTES.HOME
      })()
    )
  }, [searchParams])

  // Don't render form if user is already logged in (they'll be redirected)
  if (user) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner />
      </div>
    )
  }

  /**
   * Helper to execute an async operation with standard loading and error handling.
   *
   * @param action - The async action to execute
   */
  const executeWithLoading = async (action: () => Promise<void>) => {
    // Reset state variables
    setLoading(true)

    // Clear any existing messages. The action might set success
    // (but shouldn't set the error)
    setGlobalError('')
    setSuccessMessage('')

    try {
      // Safely perform the action
      await action()
    } catch (error) {
      // Either set the generic provided message or figure
      // out the error message from Clerk
      setGlobalError(getErrorMessage(error))
    } finally {
      // No loading state after the operation
      setLoading(false)
    }
  }

  /**
   * Handles email entry submission.
   * Checks if email exists and routes to appropriate flow.
   *
   * @param data - The form data containing the email address
   */
  const handleEmailEntry = async (data: ResetPasswordFormData) => {
    await executeWithLoading(async () => {
      // Check if email exists using server action
      const emailExists = await checkEmailExists(data.email)

      // Store the email for use in the next step
      setEnteredEmail(data.email)

      // Route to login if email exists, signup if it doesn't
      switchScreen(emailExists ? 'login-with-email' : 'signup-with-email')

      // If the email has changed, we want to clear the name and code fields
      if (data.email !== enteredEmail) {
        methods.setValue('name', '')
        methods.setValue('code', '')
      }
    })
  }

  /**
   * Handles login form submission.
   *
   * @param data - The login form data (email and password)
   */
  const handleLogin = async (data: LoginFormData) => {
    // I suppose this should never happens
    if (!signIn) return

    // Try to sign in
    await executeWithLoading(async () => {
      const result = await signIn.create({
        identifier: data.email,
        password: data.password,
      })

      // If sign in was successful
      if (result.status === 'complete') {
        // Use Clerk's setActiveSignIn to set the active sign in
        // (which will cause a re-render which will cause a redirect)
        await setActiveSignIn({ session: result.createdSessionId })
      }
      // Otherwise throw an error
      else {
        throw new Error('Unexpected error while signing in')
      }
    })
  }

  /**
   * Handles signup form submission.
   *
   * @param data - The signup form data (email, password, name)
   */
  const handleSignup = async (data: SignupFormData) => {
    // I suppose this should never happen
    if (!signUp) return

    // Try to sign up
    await executeWithLoading(async () => {
      const result = await signUp.create({
        emailAddress: data.email,
        password: data.password,
        firstName: data.name,
      })

      // If sign up was successful
      if (result.status === 'complete') {
        // Use Clerk's setActiveSignUp to set the active sign up
        // (which will cause a re-render which will cause a redirect)
        await setActiveSignUp({ session: result.createdSessionId })
      }
      // The backend is setup to have just the email verification strategy
      else if (result.status === 'missing_requirements') {
        // With just email missing, we can start the email verification process
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })

        // Switch to verification screen
        switchScreen('email-verification')
      }
      // Otherwise throw an error
      else {
        throw new Error('Unexpected error while signing up')
      }
    })
  }

  /**
   * Handles password reset form submission (sends code to email).
   *
   * @param data - The password reset form data (email)
   */
  const handleForgottenPassword = async (data: ResetPasswordFormData) => {
    // I suppose this should never happen
    if (!signIn) return

    // Try to send reset code
    await executeWithLoading(async () => {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: data.email,
      })

      // Store the email for use in the next step
      setEnteredEmail(data.email)

      // Set success message before changing screen
      setSuccessMessage('Email s kódom na obnovenie hesla bol odoslaný.')

      // Switch to the code entry screen
      switchScreen('password-reset-code')

      // If the email has changed, we want to clear the code field
      if (data.email !== enteredEmail) {
        methods.setValue('code', '')
      }
    })
  }

  /**
   * Handles reset code verification.
   *
   * @param data - The reset code form data
   */
  const handleResetCode = async (data: ResetCodeFormData) => {
    // I suppose this should never happen
    if (!signIn) return

    // Try to verify the code
    await executeWithLoading(async () => {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: data.code,
      })

      // If the code was verified...
      if (result.status === 'needs_new_password') {
        // Clear any previous password values
        methods.setValue('password', '')
        methods.setValue('confirmPassword', '')

        // Switch to the new password entry screen
        switchScreen('enter-new-password')
      }
      // Otherwise throw an error
      else {
        throw new Error('Unexpected error while verifying reset code')
      }
    })
  }

  /**
   * Handles new password submission and signs user in.
   *
   * @param data - The new password form data
   */
  const handleNewPassword = async (data: NewPasswordFormData) => {
    // I suppose this should never happen
    if (!signIn) return

    // Try to reset the password
    await executeWithLoading(async () => {
      const result = await signIn.resetPassword({
        password: data.password,
      })

      // Throw an error if the password reset failed
      if (result.status !== 'complete') {
        throw new Error('Password reset failed')
      }

      // Show success message
      setSuccessMessage('Heslo bolo úspešne zmenené! Presmerovávam vás...')

      // Wait a moment so user can see the confirmation
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // Otherwise log the user in
      // (which will cause a re-render which will cause a redirect)
      await setActiveSignIn({ session: result.createdSessionId })
    })
  }

  /**
   * Handles email verification code submission.
   *
   * @param data - The verification code form data
   */
  const handleEmailVerification = async (data: EmailVerificationFormData) => {
    // I suppose this should never happen
    if (!signUp) return

    // Try to verify the code
    await executeWithLoading(async () => {
      const result = await signUp.attemptEmailAddressVerification({
        code: data.code,
      })

      // If verification was successful
      if (result.status === 'complete') {
        // Use Clerk's setActiveSignUp to set the active sign up
        // (which will cause a re-render which will cause a redirect)
        await setActiveSignUp({ session: result.createdSessionId })
      }
      // Otherwise throw an error
      else {
        throw new Error('Verification failed')
      }
    })
  }

  /**
   * Handles form submission based on current mode.
   *
   * @param data - The form data from any of the auth forms
   */
  const onSubmit = (data: AuthFormValues) => {
    switch (screen) {
      case 'enter-email':
        handleEmailEntry(data as EnterEmailFormData)
        break
      case 'login-with-email':
        handleLogin(data as LoginFormData)
        break
      case 'signup-with-email':
        handleSignup(data as SignupFormData)
        break
      case 'forgotten-password':
        handleForgottenPassword(data as ResetPasswordFormData)
        break
      case 'password-reset-code':
        handleResetCode(data as ResetCodeFormData)
        break
      case 'enter-new-password':
        handleNewPassword(data as NewPasswordFormData)
        break
      case 'email-verification':
        handleEmailVerification(data as EmailVerificationFormData)
        break
    }
  }

  /**
   * Handles OAuth authentication for various providers.
   *
   * @param strategy - The OAuth strategy to use (e.g., 'oauth_google', 'oauth_facebook')
   */
  const handleOAuthLogin = async (strategy: 'oauth_google' | 'oauth_facebook') => {
    // I suppose this should never happen
    if (!signIn) return

    // Try to authenticate with the OAuth provider
    await executeWithLoading(async () => {
      await signIn.authenticateWithRedirect({
        strategy,
        redirectUrl: ROUTES.SSO_CALLBACK,
        redirectUrlComplete: returnUrl || ROUTES.PROFILE,
      })
    })
  }

  /**
   * Converts Clerk error objects to user-friendly Slovak messages.
   *
   * @param error - The error object from Clerk
   *
   * @returns A localized error message string
   */
  const getErrorMessage = (error: unknown) => {
    // A map of Clerk error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      form_password_incorrect: 'Nesprávny email alebo heslo',
      form_identifier_not_found: 'Nesprávny email alebo heslo',
      form_password_pwned: 'Toto heslo bolo nájdené v databáze úniku dát. Použite iné heslo.',
      form_password_length_too_short: 'Heslo musí mať aspoň 8 znakov',
      form_identifier_exists: 'Účet s týmto emailom už existuje',
      too_many_attempts: 'Príliš mnoho pokusov. Skúste to prosím neskôr.',
      form_code_incorrect: 'Nesprávny kód.',
      form_verification_failed: 'Overenie kódu zlyhalo. Skúste to prosím znova.',
      session_exists: 'Už ste prihlásený. Obnovte stránku.',
      session_already_exists: 'Už ste prihlásený. Obnovte stránku.',
    }

    // Extract error code and message from Clerk error
    const { code, message } = getClerkErrorDetails(error)

    // Return the appropriate error message
    if (code && errorMessages[code]) {
      return errorMessages[code]
    }

    // Log the error for debugging purposes
    console.error('Unexpected Clerk error:', message)

    // By default a generic error message is returned
    return 'Vyskytla sa chyba. Skúste to prosím znova.'
  }

  /**
   * Switches between authentication screens and resets form state.
   *
   * @param newScreen - The new authentication screen to switch to
   */
  const switchScreen = (newScreen: AuthScreen) => {
    // Switch to the new screen
    setScreen(newScreen)

    // Reset messages
    setGlobalError('')
    setSuccessMessage('')

    // When we get back to 'hub', we'll forget any previously entered email
    if (newScreen === 'hub') {
      setEnteredEmail('')
      methods.reset()
      console.log('Going to hub screen')
    } else {
      // Get current values
      const values = methods.getValues()

      // Clear password fields when switching screens
      const mutableValues = values as Record<string, unknown>
      if (mutableValues.password) {
        mutableValues.password = ''
      }
      if (mutableValues.confirmPassword) {
        mutableValues.confirmPassword = ''
      }

      // Reset validation state (isSubmitted, etc.) but keep current values (except passwords)
      methods.reset(values)
    }
  }

  return (
    <div className="w-full max-w-[350px] m-4 sm:m-8 md:m-12 p-8 bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-700/50 shadow-2xl">
      {/* Required for Clerk CAPTCHA widget */}
      <div id="clerk-captcha" />

      {/* Header */}
      <AuthFormHeader screen={screen} />

      {/* Error Message */}
      {globalError && <AuthMessage type="error" message={globalError} />}

      {/* Success Message */}
      {successMessage && <AuthMessage type="success" message={successMessage} />}

      {/* Hub Screen */}
      {screen === 'hub' && (
        <AuthHubScreen
          onContinueWithEmail={() => switchScreen('enter-email')}
          onGoogleLogin={() => handleOAuthLogin('oauth_google')}
          onFacebookLogin={() => handleOAuthLogin('oauth_facebook')}
          loading={loading}
        />
      )}

      {/* Email Entry, Login, Signup, Reset, Reset Code, and Reset Password Screens */}
      {screen !== 'hub' && (
        <FormProvider {...methods}>
          <form
            onSubmit={methods.handleSubmit((data) => onSubmit(data as AuthFormValues))}
            noValidate
          >
            {/* The form fields */}
            <AuthFormFields screen={screen} enteredEmail={enteredEmail} />

            {/* The form actions */}
            <AuthFormActions
              screen={screen}
              loading={loading}
              onScreenSwitch={switchScreen}
              onBack={() => {
                switch (screen) {
                  case 'enter-email':
                    switchScreen('hub')
                    break

                  case 'login-with-email':
                  case 'signup-with-email':
                    switchScreen('enter-email')
                    break

                  case 'forgotten-password':
                    switchScreen('login-with-email')
                    break

                  case 'password-reset-code':
                    switchScreen('forgotten-password')
                    break

                  case 'enter-new-password':
                    switchScreen('password-reset-code')
                    break

                  case 'email-verification':
                    // Go back to signup if they want to change email or something
                    switchScreen('signup-with-email')
                    break
                }
              }}
            />
          </form>
        </FormProvider>
      )}
    </div>
  )
}
