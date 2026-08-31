import { RichMathEditorRenderer } from './RichMathEditorRenderer'

/**
 * Props for the {@link ProblemMarkdown} component.
 */
type ProblemMarkdownProps = {
  /** A problem's markdown, either its statement or its solution. */
  content: string
}

/**
 * Renders a problem's own markdown, its statement or its solution. Problem figures are diagrams
 * whose strokes assume a light backdrop, and their `media:` keys resolve against the problems
 * host, so both are settled here and every surface draws a figure the same way.
 */
export function ProblemMarkdown({ content }: ProblemMarkdownProps) {
  return <RichMathEditorRenderer content={content} imageContext="problems" lightImageBackground />
}
