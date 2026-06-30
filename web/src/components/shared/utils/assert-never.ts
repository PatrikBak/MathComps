/**
 * Marks an unreachable branch so an unhandled union member becomes a compile error.
 *
 * Call it from a `switch` default (or final `else`) over a discriminated union: TypeScript only
 * accepts the call when every member has been narrowed away, so adding a new member without a case
 * fails the build. At runtime it throws, guarding against malformed data that slips past the types.
 *
 * @param value - The value that should already be narrowed to `never`.
 *
 * @returns Never returns — always throws.
 */
export function assertNever(value: never): never {
  // Reaching here means a union member went unhandled
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`)
}
