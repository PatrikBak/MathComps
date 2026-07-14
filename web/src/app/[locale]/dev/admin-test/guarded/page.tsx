import { requireAdmin } from '@/lib/auth/admin-auth'

/**
 * Dev-only page guarded by {@link requireAdmin} — admins see the body, everyone
 * else is redirected home before it renders.
 */
export default async function GuardedAdminPage() {
  // Redirect non-admins away before rendering anything
  await requireAdmin()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Confirmation shown only to admins who passed the guard */}
      <p className="text-sm">You are an admin — this page passed the requireAdmin guard.</p>
    </div>
  )
}
