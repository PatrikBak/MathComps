'use client'

import type { RefObject } from 'react'
import { useState } from 'react'

import type { RichMathEditorRef } from '@/components/shared/components/rich-math-editor/components/RichMathEditor'

import type { DefenseTarget } from '../model/defense-target'
import type { DefensePhotoHandoff } from '../model/photo-handoff-code'
import type { UseComposerPhotosResult } from './use-composer-photos'
import { useDefensePhotoHandoff } from './use-defense-photo-handoff'

/**
 * No photo dialog open.
 */
type ShutPhotoDialog = {
  /** The discriminant. */
  kind: 'shut'
}

/**
 * The dialog with the QR code the student scans to send photos from their phone.
 */
type PhonePhotoDialog = {
  /** The discriminant. */
  kind: 'phone'
}

/**
 * The review, open on one photo, where each page's text is checked before it goes into the message.
 */
type ReviewPhotoDialog = {
  /** The discriminant. */
  kind: 'review'
  /** The photo looked at. */
  photoId: number
}

/**
 * What the dialog over the composer's photos shows.
 */
type DefensePhotoDialog = ShutPhotoDialog | PhonePhotoDialog | ReviewPhotoDialog

/**
 * Options for {@link useDefensePhotoReview}.
 */
type UseDefensePhotoReviewOptions = {
  /** The composer's photos and what can be done with them. */
  photos: UseComposerPhotosResult
  /** The composer's handle. */
  editorRef: RefObject<RichMathEditorRef | null>
  /** What the student is defending. */
  target: DefenseTarget
}

/**
 * The dialog over the composer's photos, and the ways into it: the review of the photos, or the QR code for
 * sending them from the student's phone.
 */
export type UseDefensePhotoReviewResult = {
  /** What the dialog shows. */
  dialog: DefensePhotoDialog
  /** The state of the code the student's phone sends photos with. */
  handoff: DefensePhotoHandoff
  /** Looks at a photo, opening the review on it while it is shut. */
  view: (id: number) => void
  /** Shuts the dialog. */
  close: () => void
  /** Takes newly picked photos, opening the review on the first of them. */
  pick: (files: readonly File[]) => void
  /** Opens the QR dialog, pointing the student's code at the target. */
  openPhone: () => void
}

/**
 * Opens and shuts the dialog over the composer's photos. Picking photos, from the composer or from the review itself,
 * starts their reading and looks at the first of them. Asking for the phone, from either place too, points the
 * student's code at the target and shows it.
 *
 * @param options - The composer's photos, its handle and its target.
 *
 * @returns What the dialog shows, and the ways into and out of it.
 */
export function useDefensePhotoReview({
  photos,
  editorRef,
  target,
}: UseDefensePhotoReviewOptions): UseDefensePhotoReviewResult {
  // What the dialog shows, shut at first
  const [dialog, setDialog] = useState<DefensePhotoDialog>({ kind: 'shut' })

  // A photo dropped while it was looked at hands the review to the first page, and the last one dropped shuts it
  if (dialog.kind === 'review' && !photos.photos.some((photo) => photo.id === dialog.photoId)) {
    // The first page left, if any
    const first = photos.photos.at(0)

    // Looked at, or the dialog shut with nothing left to look at
    setDialog(first === undefined ? { kind: 'shut' } : { kind: 'review', photoId: first.id })
  }

  // Looks at a photo
  const view = (id: number) => setDialog({ kind: 'review', photoId: id })

  // Shuts the dialog
  const close = () => setDialog({ kind: 'shut' })

  // Takes picked photos, looking at the first of them straight away
  const pick = (files: readonly File[]) => {
    // The expanded editor makes way, the photos being picked from it too
    editorRef.current?.collapse()

    // The photos start reading
    const [first] = photos.addPhotos(files)

    // And the first of them is looked at
    if (first !== undefined) view(first)
  }

  // The code the student's phone sends photos with, and the way to point it
  const { handoff, point } = useDefensePhotoHandoff({ target })

  // Opens the QR dialog
  const openPhone = () => {
    // The expanded editor collapses, since its photo button opens this dialog too
    editorRef.current?.collapse()

    // The code is pointed at the target, which the dialog shows once it comes
    point()

    // And the dialog shows the handoff
    setDialog({ kind: 'phone' })
  }

  // What the dialog shows, and the ways into and out of it
  return { dialog, handoff, view, close, pick, openPhone }
}
