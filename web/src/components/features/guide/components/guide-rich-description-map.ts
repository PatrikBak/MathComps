import type { ReactNode } from 'react'

import { assertNever } from '@/components/shared/utils/assert-never'
import type { Locale } from '@/i18n/i18n'

import type { GuideDescription } from '../content/guide-content-types'

/**
 * Identifies one description slot in the guide. A bare entity id keys the entity's main description; a
 * detail slot keys one of the entity's detail bullets. The rich-description map is keyed by these slots.
 *
 * @param entityId - The entity's globally-unique id.
 * @param detailIndex - The detail-bullet index, or omitted for the main description.
 *
 * @returns The slot key.
 */
export function descriptionSlotKey(entityId: string, detailIndex?: number): string {
  // A detail bullet gets its own slot; the main description keys on the bare id
  return detailIndex === undefined ? entityId : `${entityId}::detail::${detailIndex}`
}

/**
 * Resolves a guide blurb to plain text — its localized value with the inline markup the rich variant
 * renders as elements stripped back to prose: `[text](url)` links reduce to their text,
 * `**bold**`/`*italic*` emphasis and `` `code` `` drop their delimiters, and `<NoWrap>` glue spans drop.
 * The plain-text counterpart of {@link resolveGuideDescription}; keep the stripping in step with the
 * inline markup the rich variant supports.
 *
 * @param description - The blurb to resolve.
 * @param locale - The active locale.
 *
 * @returns The plain-text blurb.
 */
export function resolveGuideDescriptionText(description: GuideDescription, locale: Locale): string {
  // The localized value with its inline markup stripped back to prose
  return (
    description.value[locale]
      // Links collapse to their visible text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Bold emphasis (** or __) drops its delimiters — before italic so it isn't half-eaten
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      // Italic: `*` anywhere, `_` only at word boundaries (CommonMark's intraword-underscore rule)
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/(?<![\p{L}\p{N}])_([^_]+)_(?![\p{L}\p{N}])/gu, '$1')
      // Inline code drops its backticks
      .replace(/`([^`]+)`/g, '$1')
      // NoWrap glue spans drop their tags, keeping their content
      .replace(/<\/?NoWrap>/g, '')
      .trim()
  )
}

/**
 * Resolves a guide blurb to its rendered node. Plain text renders as-is; rich prose uses its
 * pre-rendered MDX node from the rich-description map.
 *
 * @param description - The blurb to resolve.
 * @param richKey - The blurb's key into the rich-description map.
 * @param richDescriptions - The pre-rendered rich-description nodes, keyed by slot.
 * @param locale - The active locale.
 *
 * @returns The rendered description node.
 */
function resolveGuideDescription(
  description: GuideDescription,
  richKey: string,
  richDescriptions: Record<string, ReactNode>,
  locale: Locale
): ReactNode {
  // Dispatch on the blurb kind
  switch (description.kind) {
    // Plain inline text: localized prose
    case 'text':
      return description.value[locale]
    // Rich prose: the pre-rendered node
    case 'rich':
      return richDescriptions[richKey]
    // Exhaustive: a new description kind becomes a compile error
    default:
      return assertNever(description)
  }
}

/**
 * The resolved blurbs a guide card renders: its main description and its detail bullets, each turned
 * into a render node (localized plain text, or a pre-rendered rich node).
 */
export type GuideCardContent = {
  /** The main description node. */
  description: ReactNode
  /** One node per detail bullet, in order (empty when the entity has none). */
  details: ReactNode[]
}

/**
 * Resolves a guide entity's main description and its detail bullets to render nodes in one step, keying
 * the main blurb by the bare entity id and each detail by id + index. The card-level pairing of
 * {@link resolveGuideDescription} with {@link descriptionSlotKey}.
 *
 * @param entityId - The entity's globally-unique id.
 * @param description - The entity's main blurb.
 * @param details - The entity's detail-bullet blurbs, in order.
 * @param richDescriptions - The pre-rendered rich-description nodes, keyed by slot.
 * @param locale - The active locale.
 *
 * @returns The resolved main description and detail nodes.
 */
export function resolveCardContent(
  entityId: string,
  description: GuideDescription,
  details: GuideDescription[],
  richDescriptions: Record<string, ReactNode>,
  locale: Locale
): GuideCardContent {
  // The main blurb, keyed by the bare id
  const resolvedDescription = resolveGuideDescription(
    description,
    descriptionSlotKey(entityId),
    richDescriptions,
    locale
  )
  // Each detail bullet, keyed by id + its index
  const resolvedDetails = details.map((detail, index) =>
    resolveGuideDescription(detail, descriptionSlotKey(entityId, index), richDescriptions, locale)
  )
  // Hand back both
  return { description: resolvedDescription, details: resolvedDetails }
}
