/**
 * The Role value granting administrative access, held in Clerk's public metadata
 * and mirrored into the session token's `role` claim.
 */
export const ADMIN_ROLE = 'admin'

/**
 * The request header holding the address a page was asked for, its locale-prefixed path plus query, which
 * a server component cannot read off the URL itself.
 */
export const REQUEST_URL_HEADER = 'x-mathcomps-request-url'

/** The login page's query parameter naming the address to send the visitor back to once they are in. */
export const RETURN_URL_PARAM = 'returnUrl'
