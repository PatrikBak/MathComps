'use client'

import { useTranslations } from 'next-intl'

import { useSignedInIdentity } from '@/components/features/profile/hooks/use-signed-in-identity'

import {
  afterDeletion,
  afterPlacement,
  afterRating,
  afterRecommendation,
  afterSetAside,
} from '../model/selection-edits'
import type {
  PlacementWrite,
  RatingWrite,
  RecommendationWrite,
  SetAsideWrite,
} from '../model/selection-types'
import {
  deleteProposal,
  placeProposal,
  setAside,
  setRating,
  setRecommended,
} from '../services/selection-service'
import { type SelectionWrite, useSelectionWrite } from './use-selection-write'

/**
 * Setting a proposal aside, or bringing it back.
 *
 * @returns The write.
 */
export function useSetAside(): SelectionWrite<SetAsideWrite> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Setting the proposal aside or bringing it back, shown ahead of the server
  return useSelectionWrite<SetAsideWrite>({
    apiFn: setAside,
    edit: afterSetAside,
    changesSlots: false,
    errorMessage: t('setAsideFailed'),
  })
}

/**
 * Recommending a proposal for one category, or taking it back, the other categories left as they stand.
 *
 * @returns The write.
 */
export function useRecommend(): SelectionWrite<RecommendationWrite> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Switching the recommendation for the one category, shown ahead of the server
  return useSelectionWrite<RecommendationWrite>({
    apiFn: setRecommended,
    edit: afterRecommendation,
    changesSlots: false,
    errorMessage: t('recommendFailed'),
  })
}

/**
 * Setting the reader's rating of a proposal, or taking it back.
 *
 * @returns The write.
 */
export function useRate(): SelectionWrite<RatingWrite> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // The reader as the page knows them, none while signed out
  const reader = useSignedInIdentity()

  // Setting the reader's rating or taking it back, shown ahead of the server once the reader is known
  return useSelectionWrite<RatingWrite>({
    apiFn: setRating,
    edit: reader === null ? null : (data, write) => afterRating(data, write, reader),
    changesSlots: false,
    errorMessage: t('rateFailed'),
  })
}

/**
 * Deleting a proposal from the selection.
 *
 * @returns The write.
 */
export function useDeleteProposal(): SelectionWrite<string> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Deleting the proposal, shown ahead of the server
  return useSelectionWrite<string>({
    apiFn: deleteProposal,
    edit: afterDeletion,
    changesSlots: true,
    errorMessage: t('deleteFailed'),
  })
}

/**
 * Putting a proposal into a slot of a board.
 *
 * @returns The write.
 */
export function usePlaceProposal(): SelectionWrite<PlacementWrite> {
  // Copy for the selection's writes
  const t = useTranslations('problemSelection.writes')

  // Putting the proposal into the slot, shown ahead of the server
  return useSelectionWrite<PlacementWrite>({
    apiFn: placeProposal,
    edit: afterPlacement,
    changesSlots: true,
    errorMessage: t('placeFailed'),
  })
}
