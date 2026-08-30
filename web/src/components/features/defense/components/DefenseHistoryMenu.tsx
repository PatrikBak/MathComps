'use client'

import { ChevronDown, History, Trash2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { memo, useState } from 'react'

import { Button, buttonVariants } from '@/components/shared/components/Button'
import { ConfirmDialog } from '@/components/shared/components/ConfirmDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/shared/components/DropdownMenu'
import { cn } from '@/components/shared/utils/css-utils'
import { toPlainTextPreview } from '@/components/shared/utils/string-utils'

import type { DefenseSession } from '../model/defense-types'

/**
 * Props for the {@link DefenseHistoryMenu}.
 */
type DefenseHistoryMenuProps = {
  /** This problem's sessions, most recently active first. */
  sessions: DefenseSession[]
  /** The id of the currently open session, if any. */
  currentSessionId: string | null
  /** Opens an existing session. */
  onSelect: (session: DefenseSession) => void
  /**
   * Deletes a session; null where none of them can be dropped, which is what a graded run passes.
   * Browsing the conversations is unaffected.
   */
  onDelete: ((sessionId: string) => Promise<void>) | null
}

/**
 * The header's history control: a dropdown listing this problem's past defenses, each resumable or
 * deletable. `modal={false}` keeps it from fighting the surrounding dialog's focus trap.
 * Memoized so composer keystrokes don't re-render the session rows.
 */
export const DefenseHistoryMenu = memo(function DefenseHistoryMenu({
  sessions,
  currentSessionId,
  onSelect,
  onDelete,
}: DefenseHistoryMenuProps) {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Locale-aware value formatter
  const format = useFormatter()

  // Whether the dropdown is open, controlled so a delete can close it before the confirm opens
  const [isOpen, setIsOpen] = useState(false)

  // The session awaiting delete confirmation, or null
  const [sessionToDelete, setSessionToDelete] = useState<DefenseSession | null>(null)

  // Arms the confirmation for a session and steps out of the dropdown
  const askToDelete = (session: DefenseSession) => {
    // Close the dropdown so only the confirmation is on screen
    setIsOpen(false)

    // Remember which session the confirmation targets
    setSessionToDelete(session)
  }

  // Deletes the armed session
  const confirmDelete = async () => {
    // Nothing armed, or nothing that can be dropped at all
    if (sessionToDelete === null || onDelete === null) {
      return
    }

    // Delete it
    await onDelete(sessionToDelete.id)
  }

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
        {/* Trigger. On mobile it collapses to an icon plus the count. */}
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'gap-1.5')}
            aria-label={t('history')}
          >
            <History size={15} className="sm:hidden" />
            <span className="hidden sm:inline">{t('history')}</span>
            <span className="grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground">
              {sessions.length}
            </span>
            <ChevronDown size={14} className="hidden sm:inline" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          {/* One row per session: resume by selecting it, delete by the overlaid control or the
              Delete key on the focused row */}
          {sessions.map((session) => {
            // The student's most recent message, absent while nothing has been said yet
            const lastStudentMessage = session.turns.findLast(
              (turn) => turn.role === 'candidate'
            )?.content

            // The turn that spoke last
            const lastTurn = session.turns[session.turns.length - 1]

            return (
              <div key={session.id} className="relative">
                {/* Resume the session by selecting the row */}
                <DropdownMenuItem
                  onSelect={() => onSelect(session)}
                  onKeyDown={(event) => {
                    // Delete on the focused row arms the confirmation, the keyboard path to the
                    // pointer-only overlay control
                    if (onDelete !== null && event.key === 'Delete') {
                      event.preventDefault()
                      askToDelete(session)
                    }
                  }}
                  className={cn(
                    'flex-col items-start gap-0.5',
                    // Room for the overlaid control, which only exists where there is one
                    onDelete !== null && 'pr-12',
                    session.id === currentSessionId && 'bg-brand/10'
                  )}
                >
                  {/* When the conversation last moved */}
                  <span className="text-[11px] text-muted">
                    {format.dateTime(new Date(lastTurn.createdAt), {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                  {/* A glimpse of the conversation, or that nothing has been said in it yet */}
                  <span
                    className={cn(
                      'w-full truncate',
                      lastStudentMessage === undefined ? 'italic text-muted' : 'text-foreground'
                    )}
                  >
                    {lastStudentMessage === undefined
                      ? t('noReplyYet')
                      : toPlainTextPreview(lastStudentMessage)}
                  </span>
                </DropdownMenuItem>

                {/* Delete the session, overlaid so its click never reaches the row's resume */}
                {onDelete !== null && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('deleteSession')}
                    onClick={() => askToDelete(session)}
                    className="absolute inset-y-0 right-0 h-auto w-11 rounded-md hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 size={15} />
                  </Button>
                )}
              </div>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Confirmation for a delete, kept outside the dropdown so it survives the menu closing */}
      <ConfirmDialog
        isOpen={sessionToDelete !== null}
        onClose={() => setSessionToDelete(null)}
        onConfirm={confirmDelete}
        title={t('deleteSessionTitle')}
        message={t('deleteSessionMessage')}
        variant="danger"
      />
    </>
  )
})
