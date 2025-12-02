/**
 * TypeScript types for Clerk webhook events
 */

/**
 * Base structure for all Clerk webhook events
 */
export type ClerkWebhookEvent = {
  /** The object type, always 'event' */
  object: 'event'
  /** The specific event type (e.g., 'user.created', 'email.created') */
  type: string
  /** The payload data associated with the event */
  data: Record<string, unknown>
  /** The timestamp when the event occurred */
  timestamp: number
  /** The unique identifier for the event instance */
  instance_id: string
}

/**
 * Data payload for email.created event
 */
type EmailCreatedData = {
  /** Unique identifier for the email */
  id: string
  /** Object type, always 'email' */
  object: 'email'
  /** The slug associated with the email template */
  slug: string
  /** The name of the sender */
  from_email_name: string
  /** The recipient's email address */
  to_email_address: string
  /** ID of the email address resource */
  email_address_id: string
  /** ID of the user receiving the email */
  user_id: string
  /** The subject line of the email */
  subject: string
  /** The HTML body of the email */
  body: string
  /** Current status of the email delivery */
  status: 'queued' | 'sent' | 'delivered' | 'failed'
  /** Additional data, often containing verification codes */
  data?: Record<string, unknown>
}

/**
 * Clerk email.created webhook event
 */
type EmailCreatedEvent = ClerkWebhookEvent & {
  /** Event type specific to email creation */
  type: 'email.created'
  /** Data payload specific to email creation */
  data: EmailCreatedData
}

/**
 * Type guard to check if an event is an email.created event
 * @param event - The generic Clerk webhook event to check
 * @returns True if the event is an email.created event, false otherwise
 */
export function isEmailCreatedEvent(event: ClerkWebhookEvent): event is EmailCreatedEvent {
  return event.type === 'email.created'
}
