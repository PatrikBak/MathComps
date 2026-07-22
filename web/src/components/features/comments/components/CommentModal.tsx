'use client'

import { MessageSquare } from 'lucide-react'

import { CountBadge } from '@/components/shared/components/CountBadge'
import { Modal } from '@/components/shared/components/Modal'

import { useFetchComments } from '../hooks/use-fetch-comments'
import type { CommentTarget } from '../services/comment-api-types'
import { countAllComments } from '../utils/comment-utils'
import { CommentSection } from './CommentSection'

/**
 * Props for the {@link CommentModal} component.
 */
type CommentModalProps = {
  /** Whether the modal is open. */
  isOpen: boolean
  /** Called when the modal should close. */
  onClose: () => void
  /** Title displayed in the modal header (e.g., article title). */
  title: string
  /** The target entity being commented on. */
  target: CommentTarget
}

/**
 * A modal for displaying comments on content.
 *
 * Wraps {@link CommentSection} in a modal with a title header
 * to provide context about what is being commented on.
 */
export function CommentModal({ isOpen, onClose, title, target }: CommentModalProps) {
  // Fetch comments to get count for display
  const { data: comments, isLoading } = useFetchComments(target)

  // Calculate comment count from real data
  const commentCount = comments ? countAllComments(comments) : 0

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl"
      showCloseButton
      align="top"
      title={
        <>
          {/* Title icon */}
          <CountBadge
            count={commentCount}
            color="indigo"
            isHighlighted={commentCount > 0}
            isLoading={isLoading}
            className="mr-5"
          >
            <MessageSquare size={22} />
          </CountBadge>
          {/* Title text */}
          <span>{title}</span>
        </>
      }
    >
      <CommentSection target={target} />
    </Modal>
  )
}
