import { MDXRemote } from 'next-mdx-remote/rsc'
import type { AnchorHTMLAttributes, HTMLAttributes, PropsWithChildren, ReactNode } from 'react'

import { AppLink } from '@/components/shared/components/AppLink'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { Locale } from '@/i18n/i18n'
import { disallowedBlockComponents } from '@/lib/mdx-card-components'

import { type GuideContent, type GuideDescription } from '../content/guide-content-types'
import { parseDeckSentinel } from '../content/guide-url'
import { DeckLink } from './DeckLink'
// Imported only for the {@link} doc tag below; the linter can't see doc references
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { descriptionSlotKey, resolveGuideDescriptionText } from './guide-rich-description-map'

/**
 * The constrained MDX component map for a rich guide blurb: a few styled inline elements plus a
 * `NoWrap` one-line wrapper, with every block-level tag rejected (the news-card pattern). `p` stays
 * margin-free so it imposes no block spacing of its own. A `#<page>` deck sentinel renders as a client
 * control that slides the deck. The plain-text counterpart of these inline tokens lives in
 * {@link resolveGuideDescriptionText} and must stay in step: a token added here needs matching
 * stripping there.
 */
const guideMdxComponents = {
  // Glue a short run onto one line (e.g. so "GeoGebra 📐" can't split before the emoji)
  NoWrap: ({ children }: PropsWithChildren) => <span className="text-no-break">{children}</span>,
  // Paragraph: margin-free so the surrounding typography owns size, color, and leading
  p: (props: HTMLAttributes<HTMLParagraphElement>) => <p className="m-0" {...props} />,
  // Links: a `#<page>` sentinel drives the deck; anything else is a normal link
  a: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // A link must carry a target
    if (!href) {
      throw new Error('Link in guide card content is missing a required href.')
    }
    // A `#<page>` sentinel slides the deck to that page (client navigation, no reload)
    const deckPage = parseDeckSentinel(href)
    if (deckPage) {
      return <DeckLink page={deckPage}>{children}</DeckLink>
    }
    // Any other link is a normal internal/external link
    return (
      <AppLink
        href={href}
        className="text-link underline transition-colors hover:text-link-hover"
        {...props}
      >
        {children}
      </AppLink>
    )
  },
  // Bold emphasis
  strong: (props: HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold text-foreground" {...props} />
  ),
  // Italic emphasis
  em: (props: HTMLAttributes<HTMLElement>) => <em className="italic" {...props} />,
  // Inline code, lightly styled
  code: (props: HTMLAttributes<HTMLElement>) => (
    <code className="rounded bg-surface-inset/70 px-1 py-0.5 text-xs text-brand-light" {...props} />
  ),
  // Block-level tags aren't allowed in a one-line description
  ...disallowedBlockComponents('guide card content'),
}

/**
 * One description slot across the guide: a blurb paired with the map key it renders under.
 */
type DescriptionSlot = {
  /** The lookup key into the rendered rich-description map. */
  key: string
  /** The blurb at this slot. */
  description: GuideDescription
}

/**
 * Every description slot across the guide — each entity's description plus each competition's detail
 * bullets — paired with its map key.
 *
 * @param content - The full guide content.
 *
 * @returns Every description slot, rich and plain alike.
 */
function collectDescriptionSlots(content: GuideContent): DescriptionSlot[] {
  // International competitions: the description, then one slot per detail bullet
  const international = content.internationalCompetitions.flatMap((competition) => [
    { key: descriptionSlotKey(competition.id), description: competition.description },
    ...competition.details.map((detail, index) => ({
      key: descriptionSlotKey(competition.id, index),
      description: detail,
    })),
  ])
  // Other competitions: just the description
  const other = content.otherCompetitions.map((competition) => ({
    key: descriptionSlotKey(competition.id),
    description: competition.description,
  }))
  // Seminars: the description, when one is authored
  const seminars = content.seminars.flatMap((seminar) =>
    seminar.description
      ? [{ key: descriptionSlotKey(seminar.id), description: seminar.description }]
      : []
  )
  // Resources: just the description
  const resources = content.resources.map((resource) => ({
    key: descriptionSlotKey(resource.id),
    description: resource.description,
  }))
  // Hand back every slot
  return [...international, ...other, ...seminars, ...resources]
}

/**
 * Pre-renders every rich guide description for the active locale, keyed by {@link descriptionSlotKey}.
 * Server-only (uses the RSC `MDXRemote`); the result is threaded into the client deck.
 *
 * @param content - The full guide content.
 * @param locale - The active locale.
 *
 * @returns Rendered descriptions keyed by entity slot (rich blurbs only).
 */
export function renderGuideRichDescriptions(
  content: GuideContent,
  locale: Locale
): Record<string, ReactNode> {
  // Render only the rich slots; plain-text ones render inline in the client card
  return Object.fromEntries(
    collectDescriptionSlots(content).flatMap(({ key, description }): [string, ReactNode][] => {
      // Render by kind: a new kind must declare whether it pre-renders
      switch (description.kind) {
        // Plain text renders inline in the client card — nothing to pre-render
        case 'text':
          return []
        // Rich prose: pre-render its inline MDX for the active locale
        case 'rich':
          return [
            [
              key,
              <MDXRemote
                key={key}
                source={description.value[locale]}
                components={guideMdxComponents}
              />,
            ],
          ]
        // Exhaustive: a new description kind becomes a compile error
        default:
          return assertNever(description)
      }
    })
  )
}
