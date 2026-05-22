import { WakeLockProvider } from '@/components/features/handouts/WakeLockProvider'

/**
 * Props for the handout detail route layout.
 */
type HandoutDetailLayoutProps = {
  /** The handout detail page rendered under `/handouts/[slug]`. */
  children: React.ReactNode
}

/**
 * Layout scoped to the handout detail route. Mounts a single
 * {@link WakeLockProvider} so the user's "keep screen on" preference persists
 * across navigation between handouts (same `[slug]` segment) and releases when
 * the user leaves the detail route — e.g. back to the handouts index.
 */
export default function HandoutDetailLayout({ children }: HandoutDetailLayoutProps) {
  return <WakeLockProvider>{children}</WakeLockProvider>
}
