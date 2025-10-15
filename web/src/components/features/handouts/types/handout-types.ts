/**
 * Typed representation of a single handout entry shown in the handouts list.
 */
export type HandoutEntry = {
  title: string
  slug: string // precomputed URL-friendly slug
  filename?: string // optional - if present, handout is available
  authors: string[]
}

/**
 * Groups handouts by a high-level category, e.g., Algebra, Teória čísel.
 */
export type HandoutSection = {
  category: string
  handouts: HandoutEntry[]
}

// #region Document structure

/** Defines the available list style types, mirroring common TeX environments. */
export type ListStyleType =
  | 'Bullet'
  | 'LowerRomanParens'
  | 'LowerAlphaParens'
  | 'UpperAlphaParens'
  | 'NumberDot'
  | 'NumberParens'
  | 'UpperRoman'

/** Represents a primitive, non-nestable content block. */
export type RawContentBlock =
  | { type: 'paragraph'; content: RawContentBlock[] }
  | { type: 'list'; items: RawContentBlock[][]; styleType: ListStyleType }
  | { type: 'math'; text: string; isDisplay: boolean }
  | { type: 'image'; id: string; scale: number; isInline: boolean }
  | { type: 'bold'; content: RawContentBlock[] }
  | { type: 'italic'; content: RawContentBlock[] }
  | { type: 'quote'; content: RawContentBlock[] }
  | { type: 'footnote'; content: RawContentBlock[] }
  | { type: 'text'; text: string }

/** Represents a theorem environment with an optional title, a body, and a proof. */
type TheoremBlock = {
  type: 'theorem'
  title?: RawContentBlock | null
  body: RawContentBlock[]
  proof: RawContentBlock[]
}

/** Represents an exercise environment with an optional title, a body, and a solution. */
type ExerciseBlock = {
  type: 'exercise'
  title?: RawContentBlock | null
  body: RawContentBlock[]
  solution: RawContentBlock[]
}

/** Represents a problem environment with difficulty, optional title, body, hints, and a solution. */
type ProblemBlock = {
  type: 'problem'
  difficulty: number
  title?: RawContentBlock | null
  body: RawContentBlock[]
  hint1?: RawContentBlock[] | null
  hint2?: RawContentBlock[] | null
  solution: RawContentBlock[]
}

/** Represents an example environment with an optional title, a body, and a solution. */
type ExampleBlock = {
  type: 'example'
  title?: RawContentBlock | null
  body: RawContentBlock[]
  solution: RawContentBlock[]
}

/** A union type representing any possible content block, including raw types and structured environments. */
type ContentBlock = RawContentBlock | TheoremBlock | ExerciseBlock | ProblemBlock | ExampleBlock

/** A container for a sequence of content blocks. */
type Text = {
  content: ContentBlock[]
}

/** A structural section of a document, with a title, level, and content. */
type DocumentSection = {
  title: string
  level: number
  text: Text
}

/** The root of a handout document, containing metadata and a list of sections. */
export type Document = {
  title: string | null
  subtitle?: string | null
  sections: DocumentSection[]
}

// #endregion
