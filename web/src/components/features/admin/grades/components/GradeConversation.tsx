'use client'

import { useTranslations } from 'next-intl'

import { CommentSection } from '@/components/features/comments/components/CommentSection'

/**
 * Props for the {@link GradeConversation} component.
 */
type GradeConversationProps = {
  /** The problem the student was graded on. */
  problemId: string
  /** The student. */
  userId: string
}

/**
 * The conversation between the graders and one student about one problem they were graded on: a comment thread
 * any admin writes in, which the student cannot see yet. Likes mean nothing between them, so there are none.
 */
export function GradeConversation({ problemId, userId }: GradeConversationProps) {
  // Grades copy
  const t = useTranslations('admin.grades')

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
      {/* The thread, named by the problem and the student like the grade itself */}
      <CommentSection
        variant="inline"
        showLikes={false}
        newCommentPlaceholder={t('conversationPlaceholder')}
        showEmptyText={false}
        target={{ targetType: 'HostedGrade', targetId: `${problemId}:${userId}` }}
      />
    </div>
  )
}
