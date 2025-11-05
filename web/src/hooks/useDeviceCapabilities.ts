'use client'

import { useOs } from '@mantine/hooks'
import * as React from 'react'

/**
 * Detects device capabilities including OS type and pointer capability.
 * Helps distinguish between desktop, tablet with keyboard, and touch-only devices.
 *
 * @returns An object containing device capability flags:
 * - `isMobileOS`: True if device is iOS or Android
 * - `isMac`: True if device is macOS
 * - `hasPointer`: True if device has pointer capability (mouse/trackpad)
 * - `isTouchOnly`: True if device is mobile OS without pointer capability
 *
 * @example
 * ```tsx
 * const { isMobileOS, isMac, hasPointer, isTouchOnly } = useDeviceCapabilities()
 *
 * if (isTouchOnly) {
 *   // Show touch-only UI
 * } else {
 *   // Show desktop UI
 * }
 * ```
 */
export function useDeviceCapabilities() {
  const os = useOs()
  const isMobileOS = os === 'ios' || os === 'android'
  const isMac = os === 'macos'

  // Detect if device has pointer capability (mouse/trackpad) vs touch-only
  // Default to true for SSR/initial render to avoid hydration mismatches
  const [hasPointer, setHasPointer] = React.useState(true)

  React.useEffect(() => {
    // Check if device has pointer capability (not touch-only)
    // This helps distinguish between tablets with keyboards vs touch-only devices
    if (typeof window === 'undefined') return

    const hasMouse = window.matchMedia('(hover: hover)').matches

    // Consider it a pointer/keyboard device if:
    // - It's not a mobile OS (desktop/tablet with keyboard)
    // - OR it has hover capability (mouse/trackpad available)
    setHasPointer(!isMobileOS || hasMouse)
  }, [isMobileOS])

  const isTouchOnly = isMobileOS && !hasPointer

  return {
    isMobileOS,
    isMac,
    hasPointer,
    isTouchOnly,
  }
}
