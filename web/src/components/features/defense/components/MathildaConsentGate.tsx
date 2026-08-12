'use client'

import { useTranslations } from 'next-intl'

import { AppLink } from '@/components/shared/components/AppLink'
import { Button } from '@/components/shared/components/Button'
import { ROUTES } from '@/i18n/i18n'

/**
 * Props for the {@link MathildaConsentGate}.
 */
type MathildaConsentGateProps = {
  /** Records the acknowledgement. */
  onAccept: () => void
  /** Whether an acknowledgement is in flight. */
  isAccepting: boolean
}

/**
 * What a student is told before their first word to Mathilda: that she is a model rather than a person, and
 * that the conversation is kept and read. Takes the composer's place until the acknowledgement is recorded.
 */
export function MathildaConsentGate({ onAccept, isAccepting }: MathildaConsentGateProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      {/* What talking to her entails */}
      <p className="max-w-[700px] text-pretty text-sm text-muted">{t('consentBody')}</p>

      {/* Giving the acknowledgement */}
      <Button variant="primary" size="sm" onClick={onAccept} loading={isAccepting}>
        {t('consentAccept')}
      </Button>

      {/* The long version, opened aside so the acknowledgement is not lost to a navigation */}
      <AppLink href={ROUTES.PRIVACY} newTab className="text-xs">
        {t('consentPolicyLink')}
      </AppLink>
    </div>
  )
}
