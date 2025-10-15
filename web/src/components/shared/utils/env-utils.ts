/**
 * Next.js needs to see the direct access of envirioment variables so that
 * it replaced them with real values during build time.
 */
const envMap: Record<string, string | undefined> = {
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
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
