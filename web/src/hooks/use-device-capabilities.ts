'use client'

import { useMediaQuery, useOs } from '@mantine/hooks'

/**
 * What the current device can do, as far as input is concerned.
 */
export type UseDeviceCapabilitiesResult = {
  /** Whether the device runs iOS or Android. */
  isMobileOS: boolean
  /** Whether the device runs macOS. */
  isMac: boolean
  /** Whether touch is the only way in. */
  isTouchOnly: boolean
}

/**
 * Reads the OS and pointer support of the device the page is running on.
 *
 * A tablet with a keyboard attached reports a mobile OS while still having a pointer, so
 * neither signal alone decides it.
 *
 * @returns The flags described by {@link UseDeviceCapabilitiesResult}.
 */
export function useDeviceCapabilities(): UseDeviceCapabilitiesResult {
  // The platform the browser reports
  const os = useOs()

  // The two OS families worth branching on
  const isMobileOS = os === 'ios' || os === 'android'
  const isMac = os === 'macos'

  // Whether a mouse or trackpad can hover, tracked live so docking a tablet is picked up.
  // The initial true keeps the server and the first client render agreeing.
  const hasMouse = useMediaQuery('(hover: hover)', true, { getInitialValueInEffect: true })

  // A desktop is taken to have a pointer outright; a phone has to prove it
  const hasPointer = !isMobileOS || hasMouse

  // A mobile OS with no pointer at all
  const isTouchOnly = isMobileOS && !hasPointer

  // The device's input capabilities
  return { isMobileOS, isMac, isTouchOnly }
}
