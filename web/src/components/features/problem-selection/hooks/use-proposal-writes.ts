'use client'

import { useTranslations } from 'next-intl'

import { afterDeletion, afterRecommendation, afterSetAside } from '../model/selection-edits'
import type { RecommendationWrite, SetAsideWrite } from '../model/selection-types'
import { deleteProposal, setAside, setRecommended } from '../services/selection-service'
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
    errorMessage: t('recommendFailed'),
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
    errorMessage: t('deleteFailed'),
  })
}
