'use client'

import { renderMathContentToHtml } from '@/components/math/utils/math-render'

type MathRendererClientProps = {
  content: string
}

export const MathRendererClient = ({ content }: MathRendererClientProps) => {
  const html = renderMathContentToHtml(content)
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
