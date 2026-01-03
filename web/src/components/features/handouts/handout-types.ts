/**
 * Typed representation of a single handout entry shown in the handouts list.
 */
export type HandoutEntry = {
  /** Permanent unique identifier (nanoid) - only present for available handouts */
  id?: string
  /** Display title of the handout */
  title: string
  /** Precomputed URL-friendly slug */
  slug: string
  /** Optional data object containing handout details - present only for available handouts */
  data?: {
    /** Content file name */
    filename: string
    /** Handout authors */
    authors: string[]
    /** Brief description for SEO/OG metadata */
    description: string
  }
}

/**
 * Groups handouts by a high-level category, e.g., Algebra, Teória čísel.
 */
export type HandoutSection = {
  /** Category name */
  category: string
  /** Array of handout entries in this category */
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
  | { type: 'paragraph'; content: RawContentBlock[]; highligted: boolean }
  | { type: 'list'; items: RawContentBlock[][]; styleType: ListStyleType }
  | { type: 'math'; text: string; isDisplay: boolean }
  | { type: 'image'; id: string; scale: number; isInline: boolean }
  | { type: 'bold'; content: RawContentBlock[] }
  | { type: 'italic'; content: RawContentBlock[] }
  | { type: 'quote'; content: RawContentBlock[] }
  | { type: 'footnote'; content: RawContentBlock[] }
  | { type: 'link'; url: string; content: RawContentBlock[] }
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
  hints: RawContentBlock[][]
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

/** Image metadata for handouts, matching the backend ImageData structure */
export type HandoutImage = {
  contentId: string
  width: string
  height: string
  scale: number
}

/** Wrapper type for handout JSON files that includes both document and images */
export type HandoutData = {
  document: Document
  images: HandoutImage[]
}

// #endregion
