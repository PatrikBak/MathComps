/**
 * Next.js needs to see the direct access of envirioment variables so that
 * it replaced them with real values during build time.
 */
const envMap: Record<string, string | undefined> = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  CONTACT_EMAIL: process.env.CONTACT_EMAIL,
  SENDER_EMAIL: process.env.SENDER_EMAIL,
}

/**
 * Gets a required environment variable, throwing an error if not defined.
 *
 * @param key - The environment variable name
 * @returns The environment variable value with trailing slashes removed
 */
export function getRequiredEnv(key: string): string {
  // Try to get the value from the env map
  const value = envMap[key]

  // Handle undefined/null values
  if (!value) {
    throw new Error(`${key} environment variable is not configured`)
  }

  // This is just a string now
  return value
}
