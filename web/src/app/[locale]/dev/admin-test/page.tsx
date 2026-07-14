import { AppLink } from '@/components/shared/components/AppLink'
import { getIsAdmin } from '@/lib/auth/admin-auth'

import { Field, Section } from './admin-test-ui'
import AdminTestPanel from './AdminTestPanel'

/**
 * Dev-only harness for the admin mechanism: shows the server-side role read, the
 * client read + backend probe (via the panel), and a link to an admin-guarded page.
 * Toggle your own `publicMetadata.role` in Clerk to see each layer flip.
 */
export default async function AdminTestPage() {
  // Server-side admin verdict, read from the session token
  const isAdmin = await getIsAdmin()

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Page title */}
      <h1 className="text-xl font-semibold">Admin access test</h1>

      {/* Server-side role read */}
      <Section title="Server read (getIsAdmin)">
        <Field label="isAdmin" value={String(isAdmin)} />
      </Section>

      {/* Client read + backend probe */}
      <AdminTestPanel />

      {/* Redirect-guard demo */}
      <Section title="Page guard (requireAdmin)">
        <AppLink href="/dev/admin-test/guarded" className="text-sm text-link underline">
          Open the guarded page
        </AppLink>
      </Section>
    </div>
  )
}
