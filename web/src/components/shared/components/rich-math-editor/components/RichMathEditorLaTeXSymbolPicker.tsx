'use client'

import { useState } from 'react'

import { cn } from '@/components/shared/utils/css-utils'

import { preventFocusLoss } from '../utils/keyboard-utils'
import { RichMathEditorPicker } from './RichMathEditorPicker'

/**
 * Symbol definition with argument count for commands.
 * - 0: Simple symbol or pre-filled command (e.g., alpha, mathbb{N})
 * - 1: Single-argument command (e.g., hat)
 * - 2: Two-argument command (e.g., frac)
 *
 * The `latex` field should contain the command WITHOUT the leading backslash.
 * For pre-filled commands like `mathbb{N}`, include the braces and content.
 */
type LatexSymbol = {
  /** LaTeX command without backslash (e.g., 'alpha', 'frac', 'mathbb{N}') */
  latex: string
  /** Unicode display character */
  display: string
  /** Number of arguments for cursor positioning. Defaults to 0 (cursor after). */
  args?: 0 | 1 | 2
}

/**
 * Array of symbols grouped by category.
 */
type LatexSymbolCategory = {
  /** Category name (e.g., 'Grécke', 'Operátory') */
  name: string
  /** Array of symbols in the category */
  symbols: LatexSymbol[]
}

/**
 * LaTeX symbols organized by category.
 */
const SYMBOL_CATEGORIES: LatexSymbolCategory[] = [
  {
    name: 'Grécke',
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
    name: 'Operátory',
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
    name: 'Relácie',
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
    name: 'Množiny',
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
    name: 'Geometria',
    symbols: [
      { latex: 'angle', display: '∠' },
      { latex: 'measuredangle', display: '∡' },
      { latex: 'sphericalangle', display: '∢' },
      { latex: 'triangle', display: '△' },
      { latex: 'perp', display: '⊥' },
      { latex: 'parallel', display: '∥' },
      { latex: 'nparallel', display: '∦' },
      { latex: 'circ', display: '°' },
    ],
  },
  {
    name: 'Iné',
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
 * Props for {@link RichMathEditorLaTeXSymbolPicker}.
 */
type RichMathEditorLaTeXSymbolPickerProps = {
  /** Callback when a symbol is selected. Receives the command (without backslash) and argument count. */
  onSymbolClick: (command: string, args: 0 | 1 | 2) => void
}

/**
 * A LaTeX symbol picker with categorized symbols.
 */
export function RichMathEditorLaTeXSymbolPicker({
  onSymbolClick,
}: RichMathEditorLaTeXSymbolPickerProps) {
  // Track the currently active category
  const [activeCategory, setActiveCategory] = useState(SYMBOL_CATEGORIES[0])

  return (
    <RichMathEditorPicker
      triggerContent={<span className="font-mono font-semibold text-sm">π</span>}
      triggerTitle="LaTeX symboly"
      popupClassName="bg-slate-800 w-[320px] sm:w-[420px]"
    >
      {({ close }) => (
        <>
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1 p-2 border-b border-slate-700/60 bg-slate-800/80">
            {SYMBOL_CATEGORIES.map((category) => (
              <button
                key={category.name}
                type="button"
                onClick={() => setActiveCategory(category)}
                onMouseDown={preventFocusLoss}
                className={cn(
                  'px-2 py-1 text-xs rounded transition-colors',
                  activeCategory === category
                    ? 'bg-indigo-500/30 text-indigo-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-slate-700/50'
                )}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Symbols Grid */}
          <div className="p-2 max-h-[240px] overflow-y-auto">
            <div className="grid">
              {SYMBOL_CATEGORIES.map((category) => (
                <div
                  key={category.name}
                  className={cn(
                    'grid grid-cols-6 sm:grid-cols-8 gap-1 col-start-1 row-start-1 content-start',
                    activeCategory === category ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  )}
                >
                  {category.symbols.map((symbol) => (
                    <button
                      key={symbol.latex}
                      type="button"
                      onMouseDown={preventFocusLoss}
                      onClick={() => {
                        onSymbolClick(symbol.latex, symbol.args ?? 0)
                        close()
                      }}
                      className="flex items-center justify-center w-10 h-10 text-lg rounded hover:bg-slate-700/60 transition-colors text-gray-200"
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
