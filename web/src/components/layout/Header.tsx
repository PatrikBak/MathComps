import { auth } from '@clerk/nextjs/server'

import HeaderClient from './HeaderClient'

/**
 * The server-side component that will "stream in" later.
 */
export async function Header() {
  // Fetch authentication state
  const { isAuthenticated } = await auth()

  // Pass it to the client component which will then render correct layout
  return <HeaderClient isAuthenticated={isAuthenticated} />
}
