/**
 * Next.js needs to see the direct access of envirioment variables so that
 * it replaced them with real values during build time.
 */
const envMap = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
  CLERK_WEBHOOK_SECRET: process.env.CLERK_WEBHOOK_SECRET,
  R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  NEXT_PUBLIC_R2_URL: process.env.NEXT_PUBLIC_R2_URL,
}

/**
 * Type of an expected environment variable
 */
type EnvKey = keyof typeof envMap

/**
 * Gets a required environment variable, throwing an error if not defined.
 *
 * @param key - The environment variable name
 *
 * @returns The environment variable value
 */
export function getRequiredEnv(key: EnvKey): string {
  // Try to get the value from the env map
  const value = envMap[key]

  // Handle undefined/null values
  if (!value) {
    throw new Error(`${key} environment variable is not configured`)
  }

  // This is just a string now
  return value
}

/**
 * Gets an optional environment variable, returning undefined if not defined.
 *
 * @param key - The environment variable name
 *
 * @returns The environment variable value, or undefined if not defined
 */
export function getOptionalEnv(key: EnvKey): string | undefined {
  return envMap[key]
}
