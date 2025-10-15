import React from 'react'

import type { RawContentBlock } from '@/components/features/handouts/types/handout-types'

import type { ProblemImage } from '../features/problems/types/problem-api-types'
import { ContentRenderer } from './ContentRenderer'

type ProblemContentRendererProps = {
  content: RawContentBlock[]
  images?: ProblemImage[]
}

export function ProblemContentRenderer({ content, images }: ProblemContentRendererProps) {
  const imagesById = React.useMemo(() => {
    const map: Record<string, ProblemImage> = {}
    for (const img of images ?? []) map[img.contentId] = img
    return map
  }, [images])

  return <ContentRenderer content={content} className="problem-content" imagesById={imagesById} />
}
