import { auth } from '@clerk/nextjs/server'

import Header from './Header'

/**
 * Server-side header component that determines user authentication status
 * and renders the appropriate client-side {@link Header} component.
 */
export default async function ServerHeader() {
  // Check for the authentificated user
  const { userId } = await auth()

  // The client will just get whether there should be any
  return <Header initialIsAuthenticated={userId !== null} />
}
