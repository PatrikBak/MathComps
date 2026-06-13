/**
 * Type definitions for handout documents loaded from JSON.
 * Do not modify the structure without coordinating with the backend JSON schema.
 */

/** The five mathematical environment types used in handouts. */
export type HandoutEnvironmentType = 'theorem' | 'exercise' | 'example' | 'problem' | 'definition'

/** A sequence of raw content blocks, used for inline or nested content. */
type RawContentSequence = RawContentBlock[]

/** A list of content sequences, used for multi-item structures like hints. */
type RawContentList = RawContentBlock[][]

/** Defines the available list style types, mirroring common TeX environments. */
export type ListStyleType =
  | 'Bullet' // • item
  | 'LowerRomanParens' // (i), (ii), (iii)
  | 'LowerAlphaParens' // (a), (b), (c)
  | 'UpperAlphaParens' // (A), (B), (C)
  | 'NumberDot' // 1., 2., 3.
  | 'NumberParens' // (1), (2), (3)
  | 'UpperRoman' // I., II., III.

/** A paragraph block containing nested content. */
type ParagraphBlock = {
  /** Discriminator */
  type: 'paragraph'
  /** The nested content blocks within the paragraph */
  content: RawContentSequence
  /** Whether the paragraph should be visually highlighted */
  highligted: boolean
}

/** A list block containing multiple items. */
type ListBlock = {
  /** Discriminator */
  type: 'list'
  /** Array of items, where each item is a sequence of content blocks */
  items: RawContentList
  /** The visual style of the list (bullets, numbers, letters, etc.) */
  styleType: ListStyleType
}

/** A mathematical expression block. */
type MathBlock = {
  /** Discriminator */
  type: 'math'
  /** The LaTeX/KaTeX source string */
  text: string
  /** If true, renders as display math (centered, larger); otherwise inline */
  isDisplay: boolean
}

/** An image reference block. */
type ImageBlock = {
  /** Discriminator */
  type: 'image'
  /** The content ID referencing the image asset */
  id: string
  /** Scaling factor for the image (1.0 = original size) */
  scale: number
  /** If true, the image is rendered inline with text */
  isInline: boolean
}

/** A bold text wrapper block. */
type BoldBlock = {
  /** Discriminator */
  type: 'bold'
  /** The content to render in bold */
  content: RawContentSequence
}

/** An italic text wrapper block. */
type ItalicBlock = {
  /** Discriminator */
  type: 'italic'
  /** The content to render in italics */
  content: RawContentSequence
}

/** A block quote wrapper. */
type QuoteBlock = {
  /** Discriminator */
  type: 'quote'
  /** The quoted content */
  content: RawContentSequence
}

/** A footnote reference block. */
type FootnoteBlock = {
  /** Discriminator */
  type: 'footnote'
  /** The footnote content */
  content: RawContentSequence
}

/** A hyperlink block wrapping content. */
type LinkBlock = {
  /** Discriminator */
  type: 'link'
  /** The target URL of the link */
  url: string
  /** The clickable content */
  content: RawContentSequence
}

/** A plain text leaf block. */
type TextBlock = {
  /** Discriminator */
  type: 'text'
  /** The raw text string */
  text: string
}

/**
 * A primitive, potentially recursive content block.
 * Some variants (e.g., paragraph, bold) can nest other {@link RawContentBlock}s,
 * while others (e.g., text, math) are leaf nodes.
 */
export type RawContentBlock =
  | ParagraphBlock
  | ListBlock
  | MathBlock
  | ImageBlock
  | BoldBlock
  | ItalicBlock
  | QuoteBlock
  | FootnoteBlock
  | LinkBlock
  | TextBlock

/** A theorem environment (e.g., lemma, proposition) with a body and proof. */
type TheoremBlock = {
  /** Discriminator */
  type: 'theorem'
  /** Optional inline title (can contain math/formatting, e.g., "Pythagorean Theorem") */
  title?: RawContentBlock | null
  /** The main statement of the theorem */
  body: RawContentSequence
  /** The proof of the theorem */
  proof: RawContentSequence
}

/** An exercise environment with a body and collapsible solution. */
type ExerciseBlock = {
  /** Discriminator */
  type: 'exercise'
  /** Optional inline title (can contain math/formatting) */
  title?: RawContentBlock | null
  /** The exercise statement/question */
  body: RawContentSequence
  /** The solution to the exercise */
  solution: RawContentSequence
}

/** A problem environment with difficulty, collapsible hints, and a solution. */
type ProblemBlock = {
  /** Discriminator */
  type: 'problem'
  /** Difficulty rating (typically 1-5 or similar scale) */
  difficulty: number
  /** Optional inline title (can contain math/formatting) */
  title?: RawContentBlock | null
  /** The problem statement */
  body: RawContentSequence
  /** Array of collapsible hints, each hint is a content sequence */
  hints: RawContentList
  /** The complete solution to the problem */
  solution: RawContentSequence
}

/** An example environment with a body and collapsible worked solution. */
type ExampleBlock = {
  /** Discriminator */
  type: 'example'
  /** Optional inline title (can contain math/formatting) */
  title?: RawContentBlock | null
  /** The example setup/problem */
  body: RawContentSequence
  /** The worked solution */
  solution: RawContentSequence
}

/** A definition environment with a body and an optional title naming the concept. */
type DefinitionBlock = {
  /** Discriminator */
  type: 'definition'
  /** Optional inline title naming the concept being defined */
  title?: RawContentBlock | null
  /** The definition statement */
  body: RawContentSequence
}

/**
 * Union type representing any possible content block.
 * Includes both raw inline types and structured environment blocks.
 */
type ContentBlock =
  | RawContentBlock
  | TheoremBlock
  | ExerciseBlock
  | ProblemBlock
  | ExampleBlock
  | DefinitionBlock

/** A container for a sequence of content blocks. */
type Text = {
  /** The array of content blocks within this text container */
  content: ContentBlock[]
}

/** A structural section of a document, with a title, level, and content. */
type DocumentSection = {
  /** The section heading text */
  title: string
  /** The nesting depth (1 = top-level, 2 = subsection, etc.) */
  level: number
  /** The content contained within this section */
  text: Text
}

/** The root of a handout document, containing metadata and a list of sections. */
export type Document = {
  /** The document title (can contain LaTeX math), or null if untitled */
  title: string | null
  /** The ordered list of document sections */
  sections: DocumentSection[]
}

/** Image metadata for handouts, matching the backend {@link HandoutImage} structure. */
export type HandoutImage = {
  /** Unique identifier for the image content */
  contentId: string
  /** The original width of the image (as a string, e.g., "400") */
  width: string
  /** The original height of the image (as a string, e.g., "300") */
  height: string
  /** The intended display scale factor */
  scale: number
}

/**
 * Wrapper type for handout JSON files that includes both document and images.
 * This is the root type for deserializing handout content files.
 */
export type HandoutData = {
  /** The structured document content */
  document: Document
  /** Array of image metadata for assets referenced in the document */
  images: HandoutImage[]
}
