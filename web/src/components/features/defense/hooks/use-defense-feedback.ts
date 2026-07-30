'use client'

import { useDisclosure } from '@mantine/hooks'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { useOptimisticMutation } from '@/hooks/use-optimistic-mutation'

import type {
  DefenseFeedback,
  DefenseOutcome,
  DefenseReportCategory,
  DefenseTurnReport,
} from '../model/defense-types'
import {
  reportTurn,
  submitFeedback,
  withdrawFeedback,
  withdrawTurnReport,
} from '../services/session-service'
import { patchCachedDefenseSession } from './defense-cache'

/**
 * A report being recorded against one examiner reply.
 */
type ReportTurnVariables = {
  /** The session the reported reply was given in. */
  sessionId: string
  /** The reported reply. */
  turnId: string
  /** Every way the reply went wrong. */
  categories: readonly DefenseReportCategory[]
  /** The student's own account of what went wrong; empty when they gave none. */
  comment: string
}

/**
 * A report being taken back off one examiner reply.
 */
type WithdrawTurnReportVariables = Pick<ReportTurnVariables, 'sessionId' | 'turnId'>

/**
 * An answer being recorded for a whole conversation.
 */
type SubmitFeedbackVariables = {
  /** The session being answered for. */
  sessionId: string
  /** What the examiner did for them. */
  outcome: DefenseOutcome
  /** What they say in their own words; empty when they let the outcome stand alone. */
  comment: string
}

/**
 * The conversation being spoken about, and the writers that change what it shows.
 */
type DefenseFeedbackInput = {
  /** The open conversation, or null when none is saved yet. */
  currentSessionId: string | null
  /** What the student already said about the conversation. */
  currentFeedback: DefenseFeedback | null
  /** What they already hold against the conversation's replies, by reply. */
  reports: ReadonlyMap<string, DefenseTurnReport>
  /** Shows a reply as reported. */
  setReport: (sessionId: string, report: DefenseTurnReport) => void
  /** Shows a reply as carrying nothing again. */
  clearReport: (sessionId: string, turnId: string) => void
  /** Shows the conversation as answered, or asking again when handed null. */
  setFeedback: (sessionId: string, feedback: DefenseFeedback | null) => void
}

/**
 * How a write reports back to the flow that fired it.
 */
type WriteOutcome = {
  /** Called once the write has landed. */
  onSuccess: () => void
  /** Called when it was refused, which only a write with something to put back listens for. */
  onError?: () => void
}

/**
 * One thing a student can say about a defense: whether its question is open, the way an answer is put on
 * record, and the confirmed removal that takes it back off again.
 *
 * @template TOpenOn - What opening the question takes, which is nothing when it is about the whole conversation.
 * @template TAnswers - What answering it reports.
 */
type FeedbackFlow<TOpenOn extends unknown[], TAnswers extends unknown[]> = {
  /** Whether the question is open. */
  isOpen: boolean
  /** Opens it. */
  open: (...openOn: TOpenOn) => void
  /** Dismisses it, leaving the record as it was. */
  close: () => void
  /** Records what the student now says, closing on it once it lands. */
  submit: (...answers: TAnswers) => void
  /** Whether an answer is on its way. */
  isSubmitting: boolean
  /** Whether the student is being asked to confirm taking back what they said. */
  isRemoving: boolean
  /** Asks them to confirm it. */
  requestRemoval: () => void
  /** Leaves what they said where it is. */
  cancelRemoval: () => void
  /** Takes it off the record. */
  confirmRemoval: () => void
}

/**
 * Saying what went wrong with one of the examiner's replies, which is asked of one reply at a time and so
 * also carries what already stands against the one being asked about.
 */
type ReportFlow = FeedbackFlow<
  [turnId: string],
  [categories: readonly DefenseReportCategory[], comment: string]
> & {
  /** What already stands against that reply, or undefined when nothing does. */
  standing: DefenseTurnReport | undefined
}

/**
 * Saying where the conversation as a whole left the student.
 */
type AnswerFlow = FeedbackFlow<[], [outcome: DefenseOutcome, comment: string]>

/**
 * The two things a student can say about a defense, each drivable on its own.
 */
type UseDefenseFeedbackResult = {
  /** Saying what went wrong with one of the examiner's replies. */
  report: ReportFlow
  /** Saying where the conversation as a whole left them. */
  answer: AnswerFlow
}

/**
 * Everything a student saying something about a defense involves: which question is open, whether a removal
 * is awaiting their word, the write itself, and what both the transcript and the cached conversations show
 * once it lands. The conversation itself is the caller's.
 *
 * @returns The two flows, each ready to hand straight to a dialog.
 */
export function useDefenseFeedback(conversation: DefenseFeedbackInput): UseDefenseFeedbackResult {
  // Defense-surface copy
  const t = useTranslations('defense')

  // Cache handle for the defense lists
  const queryClient = useQueryClient()

  // What the student is told when a write can't be made or doesn't land, which is the same whichever of the
  // four it was
  const failureCopy = {
    authReason: t('feedbackAuthReason'),
    errorMessage: t('feedbackError'),
  }

  // Records the report
  const reportSubmission = useOptimisticMutation<void, ReportTurnVariables>({
    apiFn: (apiCall, variables) =>
      reportTurn(
        apiCall,
        variables.sessionId,
        variables.turnId,
        variables.categories,
        variables.comment
      ),
    // The stored session carries its reports, so a reopened conversation has to show the new one
    onSuccess: (_data, variables) =>
      patchCachedDefenseSession(queryClient, variables.sessionId, (session) => ({
        ...session,
        reports: [
          ...session.reports.filter((report) => report.turnId !== variables.turnId),
          {
            turnId: variables.turnId,
            categories: [...variables.categories],
            comment: variables.comment || null,
          },
        ],
      })),
    ...failureCopy,
  })

  // Takes the report back off the reply
  const reportWithdrawal = useOptimisticMutation<void, WithdrawTurnReportVariables>({
    apiFn: (apiCall, variables) =>
      withdrawTurnReport(apiCall, variables.sessionId, variables.turnId),
    // The stored session carries its reports, so a reopened conversation has to stop showing this one
    onSuccess: (_data, variables) =>
      patchCachedDefenseSession(queryClient, variables.sessionId, (session) => ({
        ...session,
        reports: session.reports.filter((report) => report.turnId !== variables.turnId),
      })),
    ...failureCopy,
  })

  // Records the answer
  const answerSubmission = useOptimisticMutation<void, SubmitFeedbackVariables>({
    apiFn: (apiCall, variables) =>
      submitFeedback(apiCall, variables.sessionId, variables.outcome, variables.comment),
    // The stored session carries the answer, so a reopened conversation has to show the new one
    onSuccess: (_data, variables) =>
      patchCachedDefenseSession(queryClient, variables.sessionId, (session) => ({
        ...session,
        feedback: { outcome: variables.outcome, comment: variables.comment || null },
      })),
    ...failureCopy,
  })

  // Takes the answer back off the conversation
  const answerWithdrawal = useOptimisticMutation<void, string>({
    apiFn: (apiCall, sessionId) => withdrawFeedback(apiCall, sessionId),
    // The stored session carries the answer, so a reopened conversation has to stop showing it
    onSuccess: (_data, sessionId) =>
      patchCachedDefenseSession(queryClient, sessionId, (session) => ({
        ...session,
        feedback: null,
      })),
    ...failureCopy,
  })

  // The reply being reported, or null when none is
  const [reportTurnId, setReportTurnId] = useState<string | null>(null)

  // Whether the student is answering for the conversation as a whole
  const [isAnswering, answering] = useDisclosure(false)

  // Whether the student is being asked to confirm taking a report back
  const [isRemovingReport, removingReport] = useDisclosure(false)

  // Whether they are being asked to confirm taking the answer back
  const [isRemovingAnswer, removingAnswer] = useDisclosure(false)

  // What the student already holds against the reply being reported, so revising opens on what they said
  const standingReport = reportTurnId === null ? undefined : conversation.reports.get(reportTurnId)

  // Dismisses the question about one reply
  const closeReport = () => setReportTurnId(null)

  // Puts what the student just said on the record and closes the question on it. The dialog holds its send
  // back until they have moved it off what already stands, so whatever arrives here says something new.
  const record = (close: () => void, show: () => void, send: (handlers: WriteOutcome) => void) => {
    // Send it. The question stays up until it lands, so a failure leaves everything they picked and wrote in
    // place to send again rather than making them recall it
    send({
      // It landed
      onSuccess: () => {
        // Let the transcript show what they said
        show()

        // Close on it
        close()

        // And say it landed, since what changes underneath is behind the dialog that is only now leaving
        toast.success(t('feedbackThanks'))
      },
    })
  }

  // Takes back something the student said, off the screen at once and off the record behind it.
  const remove = <TStanding>(
    standing: TStanding | null | undefined,
    takeOff: () => void,
    putBack: (standing: TStanding) => void,
    withdraw: (handlers: WriteOutcome) => void
  ) => {
    // Nothing stands, so the student is already where they asked to be
    if (standing === null || standing === undefined) {
      return
    }

    // Close the question and stop the transcript showing it, both now rather than when the write lands: the
    // confirmation is gone the moment it is answered, and anything left standing behind it reads as being
    // sent a second time
    takeOff()

    // Take it off the record
    withdraw({
      // Say it is gone
      onSuccess: () => toast.success(t('feedbackWithdrawn')),
      // It still stands, so show it again; the failure speaks for itself in a toast
      onError: () => putBack(standing),
    })
  }

  // Records what the student holds against the reply whose question is open
  const submitReport = (categories: readonly DefenseReportCategory[], comment: string) => {
    // Nothing armed, or nothing saved to record the report against
    if (reportTurnId === null || conversation.currentSessionId === null) {
      return
    }

    // The reply being reported, and the conversation it was given in, which this may have moved on from by
    // the time the write lands
    const turnId = reportTurnId
    const sessionId = conversation.currentSessionId

    // What the student now holds against the reply
    const report: DefenseTurnReport = {
      turnId,
      categories: [...categories],
      comment: comment || null,
    }

    // Put it on the record, marking the reply as it goes
    record(
      closeReport,
      () => conversation.setReport(sessionId, report),
      (handlers) => reportSubmission.mutate({ sessionId, turnId, categories, comment }, handlers)
    )
  }

  // Records what the student says the conversation as a whole came to
  const submitAnswer = (outcome: DefenseOutcome, comment: string) => {
    // Nothing to answer for until the conversation is saved
    if (conversation.currentSessionId === null) {
      return
    }

    // The conversation being answered for, which this may have moved on from by the time the write lands
    const sessionId = conversation.currentSessionId

    // What the student now says about it
    const feedback: DefenseFeedback = { outcome, comment: comment || null }

    // Put it on the record, showing it in the prompt's place as it goes
    record(
      answering.close,
      () => conversation.setFeedback(sessionId, feedback),
      (handlers) => answerSubmission.mutate({ sessionId, outcome, comment }, handlers)
    )
  }

  // Takes back what the student holds against the reply whose question is open. The confirmation dismisses
  // itself before running this, so the reply it was armed for is still the one open here.
  const confirmReportRemoval = () => {
    // Nothing armed, or nothing saved to take a report off
    if (reportTurnId === null || conversation.currentSessionId === null) {
      return
    }

    // The reply losing its report, and the conversation it was given in, both held past the closing below
    const turnId = reportTurnId
    const sessionId = conversation.currentSessionId

    // What is being taken off, kept so a refused removal can put it back
    const removed = conversation.reports.get(turnId)

    // Drop it, unmarking the reply as it goes
    remove(
      removed,
      () => {
        closeReport()
        conversation.clearReport(sessionId, turnId)
      },
      (report) => conversation.setReport(sessionId, report),
      (handlers) => reportWithdrawal.mutate({ sessionId, turnId }, handlers)
    )
  }

  // Takes back what the student said the conversation came to
  const confirmAnswerRemoval = () => {
    // Nothing saved to take an answer off
    if (conversation.currentSessionId === null) {
      return
    }

    // The conversation losing its answer, held past the closing below
    const sessionId = conversation.currentSessionId

    // What is being taken off, kept so a refused removal can put it back
    const removed = conversation.currentFeedback

    // Drop it, leaving the conversation asking again as it goes
    remove(
      removed,
      () => {
        answering.close()
        conversation.setFeedback(sessionId, null)
      },
      (feedback) => conversation.setFeedback(sessionId, feedback),
      (handlers) => answerWithdrawal.mutate(sessionId, handlers)
    )
  }

  // The two flows, each ready to hand straight to a dialog
  return {
    report: {
      isOpen: reportTurnId !== null,
      standing: standingReport,
      open: setReportTurnId,
      close: closeReport,
      submit: submitReport,
      isSubmitting: reportSubmission.isPending,
      isRemoving: isRemovingReport,
      requestRemoval: removingReport.open,
      cancelRemoval: removingReport.close,
      confirmRemoval: confirmReportRemoval,
    },
    answer: {
      isOpen: isAnswering,
      open: answering.open,
      close: answering.close,
      submit: submitAnswer,
      isSubmitting: answerSubmission.isPending,
      isRemoving: isRemovingAnswer,
      requestRemoval: removingAnswer.open,
      cancelRemoval: removingAnswer.close,
      confirmRemoval: confirmAnswerRemoval,
    },
  }
}
