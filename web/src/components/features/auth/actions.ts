'use server'

import { clerkClient } from '@clerk/nextjs/server'

/**
 * Checks if a user with the given email address exists in the system.
 *
 * @param email - The email address to check
 *
 * @returns True if a user with this email exists, false otherwise
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const client = await clerkClient()
  const users = await client.users.getUserList({
    emailAddress: [email],
  })
  return users.data.length > 0
}
