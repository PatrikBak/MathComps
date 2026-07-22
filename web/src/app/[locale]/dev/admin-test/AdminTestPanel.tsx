'use client'

import { useUser } from '@clerk/nextjs'
import { useState } from 'react'

import { getAdminWhoamiUrl } from '@/components/features/admin/services/admin-api-urls'
import { useApi } from '@/hooks/use-api'
import { useIsAdmin } from '@/hooks/use-is-admin'
import type { ApiResult } from '@/types/api'

import { Field, Section } from './admin-test-ui'

/**
 * The admin identity echoed by the backend `/admin/whoami` probe.
 */
type AdminWhoamiResponse = {
  /** The caller's Clerk external user id. */
  externalId: string
  /** The caller's Role claim. */
  role: string | null
}

/**
 * Dev-only panel that exercises the admin mechanism from the client: it shows the
 * client-side role read and calls the admin-gated backend probe so the 200/403
 * outcome of the policy can be observed in place.
 */
export default function AdminTestPanel() {
  // Clerk's client-side user
  const { user } = useUser()

  // Client-side admin verdict
  const isAdmin = useIsAdmin()

  // Authenticated API client
  const api = useApi({ requireAuth: true })

  // Whether the probe call is in flight
  const [isCalling, setIsCalling] = useState(false)

  // The last probe outcome, or null before the first call
  const [result, setResult] = useState<ApiResult<AdminWhoamiResponse> | null>(null)

  /**
   * Fires the admin-gated probe and captures its result in component state.
   */
  async function callWhoami() {
    // Bail if the client isn't ready (signed out / still loading)
    if (api.state !== 'ready') {
      return
    }

    // Mark the call as in flight
    setIsCalling(true)

    // Hit the admin-gated backend probe
    const response = await api.apiCall<AdminWhoamiResponse>(getAdminWhoamiUrl)

    // Store the outcome
    setResult(response)

    // Clear the in-flight flag
    setIsCalling(false)
  }

  return (
    <div className="space-y-6">
      {/* Client-side role read */}
      <Section title="Client read (useIsAdmin)">
        <Field label="isAdmin" value={String(isAdmin)} />
        <Field label="publicMetadata.role" value={String(user?.publicMetadata.role)} />
      </Section>

      {/* Backend policy probe */}
      <Section title="Backend probe (GET /admin/whoami)">
        <button
          onClick={callWhoami}
          disabled={api.state !== 'ready' || isCalling}
          className="rounded-md bg-foreground/10 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-foreground/15 disabled:opacity-50"
        >
          {isCalling ? 'Calling…' : 'Call /admin/whoami'}
        </button>

        {/* Not signed in — nothing to call with */}
        {api.state === 'unauthenticated' && (
          <p className="mt-2 text-sm text-muted">Sign in to call the endpoint.</p>
        )}

        {/* Render the outcome once a call has returned */}
        {result && (
          <pre className="mt-3 overflow-x-auto rounded bg-foreground/5 p-3 text-xs">
            {result.success
              ? JSON.stringify(result.data, null, 2)
              : `${result.error.statusCode ?? ''} ${result.error.errorCode ?? ''} — ${result.error.message}`}
          </pre>
        )}
      </Section>
    </div>
  )
}
