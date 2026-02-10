import { z } from 'zod'

/**
 * Maximum length for a list name, matching the backend's `Name` column constraint.
 */
const LIST_NAME_MAX_LENGTH = 50

/**
 * Zod schema for validating user list names.
 * Used by both inline creation and rename (via EditableTextField).
 * Trims whitespace, enforces non-empty and max-length.
 */
export const listNameSchema = z.string().trim().min(1).max(LIST_NAME_MAX_LENGTH)
