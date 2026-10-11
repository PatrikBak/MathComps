'use client'

import { useMemo } from 'react'

import { useCommentCounts } from '@/components/features/comments/hooks/use-comment-counts'

import { useLoadedSelection } from '../components/SelectionWorkspaceProvider'

/**
 * How many comments a paper's discussion holds, for a part drawn inside the selection's workspace once the selection
 * has arrived. Every paper is counted in the one read, which each caller shares.
 *
 * @param paperId - The paper.
 *
 * @returns The count; zero until the read lands.
 */
export function usePaperCommentCount(paperId: string): number {
  // Every paper, by id
  const { papersById } = useLoadedSelection()

  // The id of every paper
  const paperIds = useMemo(() => [...papersById.keys()], [papersById])

  // How many comments each paper's discussion holds
  const { counts } = useCommentCounts('SelectionPaper', paperIds)

  // The paper's count, none where its discussion holds nothing
  return counts[paperId] ?? 0
}
