'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'
import { preventFocusLoss } from '@/components/shared/utils/dom-utils'

import { RichMathEditorPicker } from './RichMathEditorPicker'

/**
 * A symbol the picker offers, and the command it writes.
 */
type LatexSymbol = {
  /**
   * LaTeX command without backslash (e.g., 'alpha', 'frac'), with its braces and content for one that
   * comes filled in (e.g., 'mathbb{N}')
   */
  latex: string
  /** How the symbol reads */
  display: string
  /** How many arguments the command takes in braces; none where left out */
  args?: 0 | 1 | 2
}

/**
 * A category the symbols are grouped under.
 */
type CategoryKey = 'greek' | 'operators' | 'relations' | 'sets' | 'geometry' | 'other'

/**
 * A category, and the symbols under it.
 */
type LatexSymbolCategory = {
  /** Which category it is */
  key: CategoryKey
  /** The symbols under it, in the order they stand */
  symbols: LatexSymbol[]
}

/**
 * Every symbol the picker offers, by category, in the order the tabs stand.
 */
const SYMBOL_CATEGORIES: LatexSymbolCategory[] = [
  {
    key: 'greek',
    symbols: [
      { latex: 'alpha', display: 'α' },
      { latex: 'beta', display: 'β' },
      { latex: 'gamma', display: 'γ' },
      { latex: 'delta', display: 'δ' },
      { latex: 'epsilon', display: 'ε' },
      { latex: 'zeta', display: 'ζ' },
      { latex: 'eta', display: 'η' },
      { latex: 'theta', display: 'θ' },
      { latex: 'lambda', display: 'λ' },
      { latex: 'mu', display: 'μ' },
      { latex: 'pi', display: 'π' },
      { latex: 'rho', display: 'ρ' },
      { latex: 'sigma', display: 'σ' },
      { latex: 'tau', display: 'τ' },
      { latex: 'phi', display: 'φ' },
      { latex: 'omega', display: 'ω' },
      { latex: 'Gamma', display: 'Γ' },
      { latex: 'Delta', display: 'Δ' },
      { latex: 'Theta', display: 'Θ' },
      { latex: 'Lambda', display: 'Λ' },
      { latex: 'Xi', display: 'Ξ' },
      { latex: 'Pi', display: 'Π' },
      { latex: 'Sigma', display: 'Σ' },
      { latex: 'Phi', display: 'Φ' },
      { latex: 'Psi', display: 'Ψ' },
      { latex: 'Omega', display: 'Ω' },
    ],
  },
  {
    key: 'operators',
    symbols: [
      { latex: 'pm', display: '±' },
      { latex: 'mp', display: '∓' },
      { latex: 'times', display: '×' },
      { latex: 'div', display: '÷' },
      { latex: 'cdot', display: '·' },
      { latex: 'circ', display: '∘' },
      { latex: 'sqrt', display: '√', args: 1 },
      { latex: 'frac', display: 'a/b', args: 2 },
      { latex: 'sum', display: '∑' },
      { latex: 'prod', display: '∏' },
      { latex: 'int', display: '∫' },
      { latex: 'oint', display: '∮' },
      { latex: 'partial', display: '∂' },
      { latex: 'nabla', display: '∇' },
      { latex: 'prime', display: '′' },
      { latex: 'forall', display: '∀' },
      { latex: 'exists', display: '∃' },
      { latex: 'neg', display: '¬' },
      { latex: 'land', display: '∧' },
      { latex: 'lor', display: '∨' },
    ],
  },
  {
    key: 'relations',
    symbols: [
      { latex: 'neq', display: '≠' },
      { latex: 'leq', display: '≤' },
      { latex: 'geq', display: '≥' },
      { latex: 'approx', display: '≈' },
      { latex: 'equiv', display: '≡' },
      { latex: 'sim', display: '∼' },
      { latex: 'cong', display: '≅' },
      { latex: 'propto', display: '∝' },
      { latex: 'to', display: '→' },
      { latex: 'leftarrow', display: '←' },
      { latex: 'leftrightarrow', display: '↔' },
      { latex: 'Rightarrow', display: '⇒' },
      { latex: 'Leftarrow', display: '⇐' },
      { latex: 'Leftrightarrow', display: '⇔' },
      { latex: 'implies', display: '⟹' },
      { latex: 'iff', display: '⟺' },
      { latex: 'uparrow', display: '↑' },
      { latex: 'downarrow', display: '↓' },
    ],
  },
  {
    key: 'sets',
    symbols: [
      { latex: 'mathbb{N}', display: 'ℕ' },
      { latex: 'mathbb{Z}', display: 'ℤ' },
      { latex: 'mathbb{Q}', display: 'ℚ' },
      { latex: 'mathbb{R}', display: 'ℝ' },
      { latex: 'mathbb{C}', display: 'ℂ' },
      { latex: 'emptyset', display: '∅' },
      { latex: 'cup', display: '∪' },
      { latex: 'cap', display: '∩' },
      { latex: 'setminus', display: '∖' },
      { latex: 'in', display: '∈' },
      { latex: 'notin', display: '∉' },
      { latex: 'subset', display: '⊂' },
      { latex: 'subseteq', display: '⊆' },
      { latex: 'supset', display: '⊃' },
      { latex: 'supseteq', display: '⊇' },
    ],
  },
  {
    key: 'geometry',
    symbols: [
      { latex: 'angle', display: '∠' },
      { latex: 'measuredangle', display: '∡' },
      { latex: 'sphericalangle', display: '∢' },
      { latex: 'triangle', display: '△' },
      { latex: 'perp', display: '⊥' },
      { latex: 'parallel', display: '∥' },
      { latex: 'nparallel', display: '∦' },
      { latex: 'degree', display: '°' },
    ],
  },
  {
    key: 'other',
    symbols: [
      { latex: 'infty', display: '∞' },
      { latex: 'ldots', display: '…' },
      { latex: 'cdots', display: '⋯' },
      { latex: 'vdots', display: '⋮' },
      { latex: 'ddots', display: '⋱' },
      { latex: 'sin', display: 'sin' },
      { latex: 'cos', display: 'cos' },
      { latex: 'tan', display: 'tan' },
      { latex: 'log', display: 'log' },
      { latex: 'ln', display: 'ln' },
      { latex: 'lim', display: 'lim' },
      { latex: 'max', display: 'max' },
      { latex: 'min', display: 'min' },
      { latex: 'hat', display: 'x̂', args: 1 },
      { latex: 'bar', display: 'x̄', args: 1 },
      { latex: 'overrightarrow', display: 'x→', args: 1 },
      { latex: 'dot', display: 'ẋ', args: 1 },
      { latex: 'ddot', display: 'ẍ', args: 1 },
      { latex: 'tilde', display: 'x̃', args: 1 },
      { latex: 'binom', display: '(ⁿₖ)', args: 2 },
    ],
  },
]

/**
 * Props for the {@link RichMathEditorLaTeXSymbolPicker} component.
 */
type RichMathEditorLaTeXSymbolPickerProps = {
  /** Whether the picker's button is a row of a list */
  isRow: boolean
  /** Callback when a symbol is selected. Receives the command (without backslash) and argument count. */
  onSymbolClick: (command: string, args: 0 | 1 | 2) => void
}

/**
 * A tool of the editor's toolbar picking a LaTeX symbol to write into the text, its symbols in tabs by
 * category.
 */
export function RichMathEditorLaTeXSymbolPicker({
  isRow,
  onSymbolClick,
}: RichMathEditorLaTeXSymbolPickerProps) {
  // The picker's translations, and its categories'
  const tLatexPicker = useTranslations('ui.editor.latexPicker')
  const tCategories = useTranslations('ui.editor.latexPicker.categories')

  // The category on show
  const [activeCategory, setActiveCategory] = useState(SYMBOL_CATEGORIES[0])

  return (
    <RichMathEditorPicker
      mark="π"
      title={tLatexPicker('title')}
      isRow={isRow}
      popupClassName="w-[320px] sm:w-[420px] overflow-hidden"
    >
      {(close) => (
        <>
          {/* Category tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-foreground/10">
            {SYMBOL_CATEGORIES.map((category) => (
              <button
                key={category.key}
                type="button"
                onClick={() => setActiveCategory(category)}
                onMouseDown={preventFocusLoss}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  activeCategory === category
                    ? 'bg-foreground/10 text-foreground'
                    : 'text-muted hover:text-foreground hover:bg-foreground/5'
                )}
              >
                {tCategories(category.key)}
              </button>
            ))}
          </div>

          {/* Symbols grid */}
          <div className="p-2 max-h-[240px] overflow-y-auto">
            <div className="grid">
              {/* Every category, stacked in one cell so the panel keeps the height of the tallest. Only the
                  one on show can be reached */}
              {SYMBOL_CATEGORIES.map((category) => (
                <div
                  key={category.key}
                  inert={activeCategory !== category}
                  className={cn(
                    'grid grid-cols-6 sm:grid-cols-8 gap-1 col-start-1 row-start-1 content-start',
                    activeCategory === category ? 'opacity-100' : 'opacity-0'
                  )}
                >
                  {category.symbols.map((symbol) => (
                    <button
                      key={symbol.latex}
                      type="button"
                      onMouseDown={preventFocusLoss}
                      onClick={() => {
                        // The panel closes first
                        close()

                        // And the picked symbol is handed over
                        onSymbolClick(symbol.latex, symbol.args ?? 0)
                      }}
                      className={cn(
                        'flex items-center justify-center w-10 h-10 rounded transition-colors',
                        'text-lg text-foreground hover:bg-foreground/5'
                      )}
                    >
                      {symbol.display}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </RichMathEditorPicker>
  )
}
