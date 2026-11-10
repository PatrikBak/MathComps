import type { PhrasingContent, Root, Text } from 'mdast'
import type { TextDirective } from 'mdast-util-directive'
import type { Transformer } from 'unified'
import { SKIP, visit } from 'unist-util-visit'

/**
 * Remark plugin which turns every text directive no earlier plugin claimed back into the text it was typed as. The
 * directive syntax reads any `:word` in prose as a directive, `1:2` and `12:30` included, and a directive that no
 * plugin gives an element renders as a bare `div`, the `:word` lost. A plugin claims a directive by setting its
 * `data.hName`, so this one runs after every plugin that claims text directives.
 *
 * @returns A unified transformer which swaps each unclaimed text directive for its source text.
 */
export function remarkUnclaimedTextDirectives(): Transformer<Root> {
  return (tree, file) => {
    visit(tree, 'textDirective', (node: TextDirective, index, parent) => {
      // A claimed directive stays, though its label may still hold an unclaimed one
      if (node.data?.hName !== undefined) return

      // Where the directive sits in the source
      const start = node.position?.start.offset
      const end = node.position?.end.offset

      // A directive needs its place in the tree and in the source to be swapped for its text
      if (parent === undefined || index === undefined || start === undefined || end === undefined)
        return

      // The directive as typed, kept where it was in the source
      const text: Text = {
        type: 'text',
        value: String(file).slice(start, end),
        position: node.position,
      }

      // The inline content holding the directive
      const siblings = parent.children as PhrasingContent[]

      // The directive swapped for its text
      siblings.splice(index, 1, text)

      // The walk staying out of the label, which is now part of the text
      return SKIP
    })
  }
}
