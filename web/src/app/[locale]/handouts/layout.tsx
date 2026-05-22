import { WakeLockProvider } from '@/components/features/handouts/WakeLockProvider'

/**
 * Props for the handouts route layout.
 */
type HandoutsLayoutProps = {
  /** Pages rendered under `/handouts` (the index and any handout detail). */
  children: React.ReactNode
}

/**
 * Layout scoped to the entire handouts route group. Mounts a single
 * {@link WakeLockProvider} so the user's "keep screen on" preference persists
 * across navigation between handouts and releases automatically when the user
 * leaves the handouts area.
 */
export default function HandoutsLayout({ children }: HandoutsLayoutProps) {
  return <WakeLockProvider>{children}</WakeLockProvider>
}
