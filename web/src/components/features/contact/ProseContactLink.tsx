import { PROSE_LINK_CLASS } from '@/components/shared/components/ProseLink'

import { type ReasonOption } from './contact-reasons'
import ContactButton from './ContactButton'

/**
 * Props for {@link ProseContactLink}.
 */
type ProseContactLinkProps = {
  /** Reason to pre-select. */
  reason?: ReasonOption
  /** The link's visible text. */
  children: React.ReactNode
}

/**
 * The {@link ContactButton} styled as an inline prose link: a sentence-level mention that opens the
 * contact modal.
 */
export function ProseContactLink({ reason, children }: ProseContactLinkProps) {
  return (
    <ContactButton reason={reason} className={PROSE_LINK_CLASS}>
      {children}
    </ContactButton>
  )
}
