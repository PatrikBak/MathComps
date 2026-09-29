/**
 * The examiner's steps in display order.
 */
export const EXAMINER_STEPS = [
  'generate',
  'mathCheck',
  'leakCheck',
  'languageCheck',
  'routeCheck',
] as const

/**
 * One step of the examiner's turn: the call that writes the reply, or one of the guards that judges it. Each routes
 * to its own model and reasoning level, so this is the axis a turn's cost breaks down along.
 */
export type ExaminerStep = (typeof EXAMINER_STEPS)[number]

/**
 * One step of the examiner's recorded settings. Every field is optional because the snapshot is stored as it was
 * written and never read into a shape by the backend, so an older one may be missing anything.
 */
export type ExaminerStepSnapshot = {
  /** Path to the step's prompt template. */
  promptPath?: string
  /** The prompt template's raw text, uninterpolated, as read when this was recorded. */
  promptText?: string
  /** The model the step was configured to run on. */
  model?: string
  /** The backup models the step was configured to fall back through, in order. */
  fallbackModels?: string[]
  /** The reasoning-effort level the step ran at. */
  reasoningEffort?: string
  /** The cap on the step's output tokens. */
  maxOutputTokens?: number
}

/**
 * One note's recorded text, uninterpolated.
 */
type ExaminerNoteSnapshot = {
  /** Path to the note. */
  path?: string
  /** The note's raw text, as read when this was recorded. */
  text?: string
}

/**
 * The notes the examiner read, for one conversation.
 */
export type ExaminerNotesSnapshot = {
  /** The wrapper every revision instruction was written into. */
  revision?: ExaminerNoteSnapshot
  /** The instruction for a reply the math check found a wrong claim in. */
  wrongClaim?: ExaminerNoteSnapshot
  /** The instruction for a reply the leak check found hands away earned progress. */
  leak?: ExaminerNoteSnapshot
  /** The instruction for a reply that keeps pressing a completed solution. */
  withheldClose?: ExaminerNoteSnapshot
  /** The instruction for a reply that drifted out of the student's language. */
  languageSwitch?: ExaminerNoteSnapshot
  /** The instruction for a reply that took the student for a man or a woman. */
  genderedAddress?: ExaminerNoteSnapshot
  /** The instruction for a reply that left the student's argument for the examiner's own. */
  route?: ExaminerNoteSnapshot
  /** The instruction a draft that outlasted the revision cap was replaced under. */
  safeHold?: ExaminerNoteSnapshot
  /** The guidance for using the author's staged hints. */
  authorHints?: ExaminerNoteSnapshot
}

/**
 * One note the examiner reads, by the name the snapshot keys it under.
 */
export type ExaminerNote = keyof ExaminerNotesSnapshot

/**
 * The examiner's recorded settings for one conversation. Empty for one held before settings were recorded at all.
 */
export type ExaminerConfigSnapshot = {
  /** The step that produces the reply. */
  generate?: ExaminerStepSnapshot
  /** The step that checks the reply's mathematics. */
  mathCheck?: ExaminerStepSnapshot
  /** The step that checks the reply gives nothing away. */
  leakCheck?: ExaminerStepSnapshot
  /** The step that checks the reply is in the student's language. */
  languageCheck?: ExaminerStepSnapshot
  /** The step that checks the reply presses the student's own argument. */
  routeCheck?: ExaminerStepSnapshot
  /** The notes the examiner read. */
  notes?: ExaminerNotesSnapshot
  /** How many times a flagged reply may be regenerated. */
  maxRevisions?: number
}
