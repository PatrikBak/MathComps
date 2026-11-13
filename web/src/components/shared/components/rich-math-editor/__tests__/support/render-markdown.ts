import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { type PluggableList, unified } from 'unified'

import { rehypePlugins, remarkPlugins } from '../../utils/markdown-pipeline'
import { preprocessDisplayMath } from '../../utils/preprocessors'

/**
 * Renders markdown through the renderer's own plugins, sanitizing included, preprocessed as the renderer does. Unlike
 * the validator, it hands back the HTML even when a plugin reported a problem, since the renderer draws it anyway.
 *
 * @param markdown - The markdown+TeX source to render.
 * @param extraRemarkPlugins - Remark plugins run after the shared ones.
 * @returns The stringified HTML output.
 */
export async function renderMarkdown(
  markdown: string,
  extraRemarkPlugins: PluggableList = []
): Promise<string> {
  // The shared pipeline, any extra remark plugins after its own
  const processor = unified()
    .use(remarkParse)
    .use(remarkPlugins)
    .use(extraRemarkPlugins)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypePlugins)
    .use(rehypeStringify)

  // The markdown preprocessed as the renderer does, then run
  const file = await processor.process(preprocessDisplayMath(markdown).text)

  // The rendered HTML
  return String(file)
}
