'use client'

import { useTranslations } from 'next-intl'

import { useSetUsername } from '../hooks/use-set-username'
import { UsernameForm } from './UsernameForm'

/**
 * What a student is asked before the first thing they write in public: the name everyone will know them by, which
 * is theirs from then on. Takes the composer's place until they have one.
 */
export function UsernameGate() {
  // Profile copy
  const tProfile = useTranslations('profile')

  // The call that claims a name, and whether one is in flight
  const { setUsername, isSaving } = useSetUsername()

  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      {/* Why they are being asked, and what it commits them to */}
      <p className="max-w-[700px] text-pretty text-sm text-muted">{tProfile('usernameGateBody')}</p>

      {/* Choosing it */}
      <UsernameForm onSubmit={setUsername} isSaving={isSaving} />
    </div>
  )
}
