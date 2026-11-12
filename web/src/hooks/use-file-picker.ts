'use client'

import { useCallbackRef, useFileDialog, useTimeout, useWindowEvent } from '@mantine/hooks'
import { useState } from 'react'

import { acceptKeepingCamera } from '@/components/shared/utils/file-picker-utils'
import { SECOND_MS } from '@/components/shared/utils/time-units'

/**
 * Options for the {@link useFilePicker} hook.
 */
type UseFilePickerOptions = {
  /** The kinds of file the picker offers, as an `accept` attribute; any file where left out. */
  accept?: string
  /** Whether several files can be picked at once. */
  multiple: boolean
  /** Takes the files the picker was closed with, called only when at least one was picked. */
  onPick: (files: File[]) => void
}

/**
 * Return type for the {@link useFilePicker} hook.
 */
export type UseFilePickerResult = {
  /** Asks for the system's file picker, unless it is already on its way. */
  open: () => void
  /** Whether the picker has been asked for and has yet to come up, for a few seconds at most. */
  isOpening: boolean
}

/**
 * The system's file picker, with word of the wait while it comes up. Some browsers, Safari above all, take a
 * moment to show it, and the page would otherwise sit there as if the press had missed. The wait ends when the
 * picker takes the window's focus, or is closed with files or without, and after a few seconds at the latest. A
 * picker that comes and goes without any of those would otherwise leave every later press ignored. A picker of
 * images keeps the camera on offer on Chromium for Android, whose photo picker has none.
 *
 * @param options - Which files the picker offers, and what takes the ones picked.
 *
 * @returns The function opening the picker, and whether it is on its way.
 */
export function useFilePicker({
  accept,
  multiple,
  onPick,
}: UseFilePickerOptions): UseFilePickerResult {
  // Whether the picker is on its way
  const [isOpening, setIsOpening] = useState(false)

  // The longest the wait can last, well past the moment a slow browser takes to show its picker
  const longestWaitMs = 3 * SECOND_MS

  // The wait's deadline
  const deadline = useTimeout(() => setIsOpening(false), longestWaitMs)

  /**
   * A function which ends the wait, its deadline with it.
   */
  const endWait = () => {
    // The deadline called off, so it cannot cut a later wait short
    deadline.clear()

    // The wait is over
    setIsOpening(false)
  }

  /**
   * A function which hands on the files a picker was closed with. The picker keeps hold of the callback it
   * opened with, so this is one that always reaches the latest {@link UseFilePickerOptions.onPick}.
   *
   * @param files - The files the picker was closed with.
   */
  const handOn = useCallbackRef((files: FileList | null) => {
    // The picker is gone, whatever it was closed with
    endWait()

    // Nothing picked
    if (files === null || files.length === 0) return

    // The files, copied out of the picker's own list
    onPick(Array.from(files))
  })

  // The kinds of file the picker goes out with, the camera kept on offer, or as given on the server
  const pickerAccept =
    typeof navigator === 'undefined' ? accept : acceptKeepingCamera(accept, navigator)

  // The picker itself
  const dialog = useFileDialog({
    accept: pickerAccept,
    multiple,
    onChange: handOn,
    onCancel: endWait,
  })

  // The picker coming up takes the window's focus, which is when the wait is over
  useWindowEvent('blur', endWait)

  /**
   * A function which asks for the picker, once however many times it is called while the picker comes up.
   */
  const open = () => {
    // Already on its way
    if (isOpening) return

    // The wait starts
    setIsOpening(true)

    // The wait's deadline set running
    deadline.start()

    // And the picker is asked for
    dialog.open()
  }

  // The opener and the wait
  return { open, isOpening }
}
