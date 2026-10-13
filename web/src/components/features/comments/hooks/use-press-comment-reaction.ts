import { useAuth } from '@clerk/nextjs'
import { useLocalStorage } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useCallback } from 'react'

import { useUserProfile } from '@/components/features/profile/hooks/use-user-profile'
import { PENDING_COMMENT_REACTION_STORAGE_KEY } from '@/constants/local-storage-constants'

import type { CommentReactionKind, CommentTarget } from '../services/comment-api-types'
import { pressCommentReaction } from '../services/comment-service'
import { pressReaction, updateCommentInTree } from '../utils/comment-utils'
import { commentQueryKeys } from './comment-query-keys'
import { useCommentMutation } from './use-comment-mutation'

/**
 * A press of a reaction on one of a thread's comments.
 */
export type CommentReactionPress = {
  /** The ID of the comment reacted to. */
  commentId: string
  /** The reaction pressed. */
  kind: CommentReactionKind
}

/**
 * A press, with the thread it is made in.
 */
type ThreadReactionPress = CommentReactionPress & {
  /** The thread the comment belongs to. */
  target: CommentTarget
}

/**
 * Hook for pressing reactions on a thread's comments with optimistic updates.
 *
 * @param target - The thread whose comments the presses go to.
 *
 * @returns A function which presses a reaction on one of the thread's comments.
 */
export function usePressCommentReaction(target: CommentTarget) {
  // Get the translations
  const t = useTranslations('comments')

  // The reader's id, absent when signed out
  const { userId } = useAuth()

  // The reader's username, null without one
  const { username } = useUserProfile()

  // The cache holding the threads
  const queryClient = useQueryClient()

  // Local storage for the reaction pressed while signed out
  const [, setPendingReaction] = useLocalStorage<CommentReactionPress | null>({
    key: PENDING_COMMENT_REACTION_STORAGE_KEY,
    defaultValue: null,
  })

  // The key every press into the thread is filed under, naming the thread by its kind and its id
  const mutationKey = ['commentReaction', target.targetType, target.targetId] as const

  // Reuse the base comment mutation
  const { mutate } = useCommentMutation<void, ThreadReactionPress>({
    // Call the API
    apiFn: (apiCall, { commentId, kind }) => pressCommentReaction(apiCall, commentId, kind),

    // Optimistically update the cache, which only a signed-in reader ever gets to
    optimisticUpdate: (comments, { commentId, kind }) =>
      userId
        ? updateCommentInTree(comments, commentId, {
            reactions: (reactions) => pressReaction(reactions, { userId, name: username, kind }),
          })
        : comments,

    // Two quick presses into the thread land in the order they were made, so the reaction stored is the last one
    // shown
    scope: { id: mutationKey.join(':') },

    // Every press into the thread filed under one key, so the thread's presses still out can be counted
    mutationKey,

    // Once the thread's last press still out settles, the thread is read again, so a failed press rolled back over
    // a later one shows what the server holds. The settling press still counts as out, hence the 1
    onSettled: () =>
      queryClient.isMutating({ mutationKey }) === 1
        ? queryClient.invalidateQueries({
            queryKey: commentQueryKeys.target(target, userId ?? null),
          })
        : undefined,

    // The reason shown in the auth prompt
    authReason: t('authReasons.reactToComment'),

    // The error message shown when the server craps out
    errorMessage: t('errors.reactionFailed'),

    // Remember the reaction the reader pressed, to press it again after sign-in
    onBeforeLoginPrompt: ({ commentId, kind }) => {
      setPendingReaction({ commentId, kind })
    },

    // Clear the pending reaction when the toast is dismissed
    onLoginPromptDismiss: () => {
      setPendingReaction(null)
    },
  })

  // A function which presses a reaction on one of the thread's comments, made in this thread
  const pressInThread = useCallback(
    (press: CommentReactionPress) => mutate({ ...press, target }),
    [mutate, target]
  )

  // Hand back the press
  return pressInThread
}
