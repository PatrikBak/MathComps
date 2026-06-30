import { useLocale, useTranslations } from 'next-intl'

import { assertNever } from '@/components/shared/utils/assert-never'
import type { Locale } from '@/i18n/i18n'

import type { GuideLink } from '../content/guide-content-types'
import { ExternalLinkButton } from './ExternalLinkButton'
import { FlagIcon } from './FlagIcon'

/**
 * Props for the {@link GuideLinkButton} component.
 */
type GuideLinkButtonProps = {
  /** The official link, with its optional chooser label. */
  link: GuideLink
}

/**
 * One official link in a card's chooser, rendered by its label: a national variant shows a flag plus
 * the localized country name, a text variant shows its authored label, and an unlabeled link (a lone
 * homepage) falls back to the formatted url.
 */
export function GuideLinkButton({ link }: GuideLinkButtonProps) {
  // Localized country names for a national variant
  const tCountries = useTranslations('countries')
  // The active locale
  const locale = useLocale() as Locale

  // No label → fall back to the formatted url
  if (!link.label) {
    return <ExternalLinkButton href={link.url} />
  }

  // Render the row by label kind
  switch (link.label.kind) {
    // National variant → a flag leads the localized country name
    case 'country':
      return (
        <ExternalLinkButton
          href={link.url}
          icon={
            <FlagIcon
              country={link.label.country}
              flagHeight={12}
              flagWidth={18}
              className="rounded-[2px]"
            />
          }
          customText={tCountries(link.label.country)}
        />
      )

    // Text variant → the authored localized label
    case 'text':
      return <ExternalLinkButton href={link.url} customText={link.label.value[locale]} />

    // Exhaustive: a new label kind becomes a compile error
    default:
      return assertNever(link.label)
  }
}
