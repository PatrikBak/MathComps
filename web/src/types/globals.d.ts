/**
 * Ambient augmentations of Clerk's role-carrying shapes, so the `role` we shape
 * from `public_metadata` is typed on both the session token and the user object.
 */
declare global {
  /** Custom claims on the Clerk session token. */
  interface CustomJwtSessionClaims {
    /** The user's Role, shaped in Clerk from `public_metadata.role`. */
    role?: string
  }

  /** Clerk user public metadata (readable on the client). */
  interface UserPublicMetadata {
    /** The user's Role. */
    role?: string
  }
}

export {}
