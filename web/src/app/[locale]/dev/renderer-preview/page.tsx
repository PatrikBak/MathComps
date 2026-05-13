'use client'

import { type ReactNode, useState } from 'react'

import { RichMathEditorRenderer } from '@/components/shared/components/rich-math-editor/components/RichMathEditorRenderer'
import { cn } from '@/components/shared/utils/css-utils'

/**
 * Props for the {@link ToggleButton} component.
 */
type ToggleButtonProps = {
  /** Whether this button represents the currently selected option */
  active: boolean
  /** Handler invoked when the button is clicked */
  onClick: () => void
  /** Button label content */
  children: ReactNode
}

/**
 * A single segmented-toggle button. Combines a stable base className with
 * active/inactive variants chosen by {@link ToggleButtonProps.active}.
 */
function ToggleButton({ active, onClick, children }: ToggleButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-foreground/10 text-foreground font-medium' : 'text-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  )
}

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

A block image with no dimension params — sized from the source at runtime, no layout reservation:

![Block placeholder](/dev-placeholders/block.svg)

A block image carrying \`?width=&height=\` — the dimensions reserve layout up front so there's no CLS while loading:

![Block with dimensions](/dev-placeholders/block.svg?width=800&height=400)

An inline image via \`?inline=true\` only — flows inside this sentence ![A](/dev-placeholders/inline-A.svg?inline=true) at its intrinsic SVG size.

An inline image via \`?inline=true&width=&height=\` — flows inside this sentence ![equiv](/dev-placeholders/inline-equiv.svg?inline=true&width=32&height=32) at the requested 32×32 size.

A block image with \`?scale=50\` — the wrapper and the rendered image both shrink to half the declared size:

![Block scaled](/dev-placeholders/block.svg?width=800&height=400&scale=50)

An inline image with \`?scale=150\` — flows inside this sentence ![scaled inline](/dev-placeholders/inline-1.svg?inline=true&width=24&height=24&scale=150) at 1.5× the declared 24×24.

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
 * Dev-only visual catalog of the markdown renderer. The toggle at the top
 * flips the {@link RichMathEditorRenderer} `lightImageBackground` prop so the
 * two image-wrap modes can be inspected in place.
 */
export default function RendererPreviewPage() {
  // Selected value for the lightImageBackground prop
  const [lightImageBackground, setLightImageBackground] = useState(false)

  // Trimmed markdown body for the renderer
  const trimmedSample = SAMPLE_MARKDOWN.trim()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 math-typography math-prose">
      {/* Segmented toggle for the lightImageBackground prop, sticky at the top */}
      <div className="sticky top-0 z-10 mb-6 inline-flex rounded-md border border-foreground/10 bg-surface overflow-hidden">
        <ToggleButton active={!lightImageBackground} onClick={() => setLightImageBackground(false)}>
          lightImageBackground = false
        </ToggleButton>
        <ToggleButton active={lightImageBackground} onClick={() => setLightImageBackground(true)}>
          lightImageBackground = true
        </ToggleButton>
      </div>

      {/* Single renderer instance driven by the toggle state */}
      <RichMathEditorRenderer content={trimmedSample} lightImageBackground={lightImageBackground} />
    </div>
  )
}
