import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'

/**
 * One large markdown document that exercises every shape the renderer handles.
 * Used by the dev-only preview page below to surface visual regressions when
 * changing pipeline plugins, sanitize rules, or rendering components.
 */
const SAMPLE_MARKDOWN = `
# Renderer catalog

A single document exercising every shape the markdown renderer supports — text styling, math, lists (default and custom-marker), spoilers, quotes, code, tables, images, and the interactions between them. Mount it whenever pipeline plugins, the sanitize schema, or render components change to spot regressions visually.

## Text and inline math

A paragraph with **bold**, *italic*, inline math $x^2 + y^2 = z^2$, and a [link to example](https://example.com).

## Display math

$$
\\int_0^1 x^2 \\, dx = \\frac{1}{3}
$$

## Default lists

A default bullet list:

- First bullet item.
- Second bullet item.
- Third bullet item.

A default numbered list:

1. First numbered item.
2. Second numbered item.
3. Third numbered item.

## Custom list styles

Number with parentheses — \`(1) (2) (3)\`:

:::list{style=number-parens}
- First case: $a > 0$.
- Second case: $a = 0$.
- Third case: $a < 0$.
:::

Lower roman with parentheses — \`(i) (ii) (iii)\`:

:::list{style=lower-roman-parens}
- Base case $n = 1$.
- Inductive step $n \\to n + 1$.
- Conclusion.
:::

Upper roman with colon suffix — \`I: II: III:\`:

:::list{style=upper-roman}
- All three roots are real and distinct.
- Exactly two roots coincide.
- All three roots coincide.
:::

Lower alpha with parentheses — \`(a) (b) (c)\`:

:::list{style=lower-alpha-parens}
- Find the minimum of $f(x) = x^2 + \\frac{1}{x}$.
- Prove the inequality is strict.
- Determine when equality is approached.
:::

Upper alpha with parentheses — \`(A) (B) (C)\`:

:::list{style=upper-alpha-parens}
- Triangle $ABC$ is acute.
- Triangle $ABC$ is right-angled.
- Triangle $ABC$ is obtuse.
:::

## Spoiler

:::spoiler[Click to reveal]
Hidden hint with math: try $u = x^2$.
:::

## Block quote

> Quoted excerpt that spans the full width and renders with a left border.

## Inline quote

The committee's reply was simply :quote[your proof is correct, but unnecessarily long], which left the contestant unsure how to revise. The browser renders this with locale-aware quotation marks via the native \`<q>\` element.

## Code

\`\`\`python
def fibonacci(n):
    return n if n < 2 else fibonacci(n - 1) + fibonacci(n - 2)
\`\`\`

## Table

| Style | Marker |
| ----- | ------ |
| bullet | • |
| number-dot | 1. |

## Images

A block image without parameters — sized at runtime, no layout reservation:

![Block placeholder](/dev-placeholders/block.svg)

A block image carrying intrinsic dimensions on the URL — \`next/image\` reserves layout up front so there is no CLS jump while the asset loads:

![Block with dimensions](/dev-placeholders/block.svg?width=800&height=400)

An inline image flowing with surrounding text via \`?inline=true\` — the angle marked ![angle](/dev-placeholders/inline-A.svg?inline=true) appears mid-sentence without breaking onto its own line.

An inline image carrying both inline and dimension flags — we use the symbol ![equiv](/dev-placeholders/inline-equiv.svg?inline=true&width=32&height=32) to denote equivalence in the rest of the proof.

## Compositions

Inline quote inside a custom-marker list:

:::list{style=lower-alpha-parens}
- The first source claims :quote[every prime greater than 3 has the form $6k \\pm 1$].
- The second source claims :quote[the sum of the first $n$ odd numbers equals $n^2$].
- Reconcile the two claims.
:::

Inline images inside a custom-marker list:

:::list{style=upper-roman}
- The first configuration is shown here: ![first](/dev-placeholders/inline-1.svg?inline=true&width=24&height=24).
- The second configuration is shown here: ![second](/dev-placeholders/inline-2.svg?inline=true&width=24&height=24).
- Compare the two configurations.
:::
`

/**
 * Dev-only visual catalog of the markdown renderer.
 */
export default function RendererPreviewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 article--math">
      <RichMathEditorRenderer content={SAMPLE_MARKDOWN.trim()} />
    </div>
  )
}
