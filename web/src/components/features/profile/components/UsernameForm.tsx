'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'

import { createUsernameSchema } from '../username-schema'

/**
 * Props for the {@link UsernameForm}.
 */
type UsernameFormProps = {
  /** Takes the name for good. */
  onSubmit: (username: string) => void
  /** Whether a name is being taken. */
  isSaving: boolean
}

/**
 * The one chance to choose a username: an input, the button that commits it, and whatever it was refused for.
 *
 * Nothing here is undoable, so a name that breaks a rule is caught before it is sent, and a name that breaks none
 * still has to be confirmed by name in a dialog. A name the backend refuses, most often because somebody else got
 * there first, arrives as a toast from the mutation itself.
 */
export function UsernameForm({ onSubmit, isSaving }: UsernameFormProps) {
  // Profile copy
  const tProfile = useTranslations('profile')

  // Validation copy
  const tValidation = useTranslations('validation')

  // What the student has typed so far
  const [value, setValue] = useState('')

  // What the name breaks, or null while it breaks nothing
  const [error, setError] = useState<string | null>(null)

  // The name waiting to be confirmed, or null while the dialog is shut
  const [pendingUsername, setPendingUsername] = useState<string | null>(null)

  /**
   * Puts the typed name up for confirmation, showing whatever rule it breaks instead.
   *
   * @param event - The submit event
   */
  const handleSubmit = (event: React.FormEvent) => {
    // The page must not navigate out from under the claim
    event.preventDefault()

    // Nothing to claim while one is already in flight
    if (isSaving) return

    // The name as it will be taken
    const username = value.trim()

    // Refuse here what the backend would refuse anyway, while it can still be fixed
    const parsed = createUsernameSchema(tValidation).safeParse(username)

    // Show the first thing wrong with it and stop
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null)
      return
    }

    // Nothing is wrong with it yet
    setError(null)

    // Say it back to them before it becomes theirs for good
    setPendingUsername(username)
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm">
      {/* The name and the button that commits it, stretched so the button takes its height from the input */}
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={tProfile('usernamePlaceholder')}
          aria-label={tProfile('username')}
          aria-invalid={error !== null}
          disabled={isSaving}
          className="form-input min-w-0 flex-1"
        />

        <Button type="submit" variant="primary" className="shrink-0" loading={isSaving}>
          {tProfile('usernameSubmit')}
        </Button>
      </div>

      {/* What the name breaks */}
      {error !== null && (
        <p role="alert" className="mt-1.5 text-xs text-error">
          {error}
        </p>
      )}

      {/* The last word before the name is theirs, since nothing undoes it afterwards */}
      <ConfirmDialog
        isOpen={pendingUsername !== null}
        onClose={() => setPendingUsername(null)}
        onConfirm={() => {
          if (pendingUsername !== null) onSubmit(pendingUsername)
        }}
        title={tProfile('usernameConfirmTitle')}
        message={tProfile.rich('usernameConfirmBody', {
          username: pendingUsername ?? '',
          name: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
        })}
        variant="warning"
      />
    </form>
  )
}
