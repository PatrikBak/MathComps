import { describe, expect, it } from 'vitest'

import type { MathGlueReader } from '../math-nowrap'
import { planMathGlue, takeLeadingGlue, takeTrailingGlue } from '../math-nowrap'

describe('takeLeadingGlue', () => {
  it('pulls a leading punctuation run and leaves the rest with its space', () => {
    // Split text that opens with a period before more prose
    const result = takeLeadingGlue('. Na začiatku')

    // The period is the glue; the space and prose stay behind
    expect(result).toEqual({ glue: '.', rest: ' Na začiatku' })
  })

  it('pulls a multi-character closing run', () => {
    // Split text opening with a closing bracket then a period
    const result = takeLeadingGlue(').')

    // The whole non-space run hugs the formula
    expect(result).toEqual({ glue: ').', rest: '' })
  })

  it('returns no glue when the text starts with whitespace', () => {
    // Leading space means the formula already has a break opportunity after it
    const result = takeLeadingGlue(' and more')

    // Nothing to pull; text is untouched
    expect(result).toEqual({ glue: '', rest: ' and more' })
  })

  it('returns no glue for an empty string', () => {
    // No text at all
    const result = takeLeadingGlue('')

    // Empty glue, empty rest
    expect(result).toEqual({ glue: '', rest: '' })
  })

  it('carries a tie and the word it joins', () => {
    // Split text opening with the non-breaking space a source `~` produces
    const result = takeLeadingGlue('\u00A0žiaroviek. Na začiatku')

    // The tie can't be left behind to open a line of its own
    expect(result).toEqual({ glue: '\u00A0žiaroviek.', rest: ' Na začiatku' })
  })
})

describe('takeTrailingGlue', () => {
  it('pulls a trailing opening run and leaves the leading text with its space', () => {
    // Split text that ends with an opening parenthesis before the formula
    const result = takeTrailingGlue('uvažujme interval (')

    // The parenthesis is the glue; the prose and its space stay behind
    expect(result).toEqual({ glue: '(', rest: 'uvažujme interval ' })
  })

  it('returns no glue when the text ends with whitespace', () => {
    // Trailing space means the formula already has a break opportunity before it
    const result = takeTrailingGlue('priradené čísla ')

    // Nothing to pull; text is untouched
    expect(result).toEqual({ glue: '', rest: 'priradené čísla ' })
  })

  it('treats an all-non-space string as entirely glue', () => {
    // No whitespace anywhere — the whole token hugs the formula
    const result = takeTrailingGlue('f(')

    // Everything is glue, nothing remains
    expect(result).toEqual({ glue: 'f(', rest: '' })
  })

  it('returns no glue for an empty string', () => {
    // No text at all
    const result = takeTrailingGlue('')

    // Empty glue, empty rest
    expect(result).toEqual({ glue: '', rest: '' })
  })

  it('carries a tie and the word it joins', () => {
    // Split text closing with a tie, as `modulo~$p$` renders it
    const result = takeTrailingGlue('hodnota modulo\u00A0')

    // The word the tie joins travels with the formula
    expect(result).toEqual({ glue: 'modulo\u00A0', rest: 'hodnota ' })
  })
})

/** A node of the toy sequence the glue pass is driven over here. */
type TestNode = {
  /**
   * What the node holds. Prose and formulas mirror the split every caller makes, and `other`
   * stands in for everything a caller reads no prose from: a display formula, a list, an image.
   */
  kind: 'text' | 'math' | 'other'
  /** The node's prose, or the formula's source. */
  value: string
  /** The prose the node wraps, which only a wrapping node holds. */
  children?: TestNode[]
}

/** A formula node of the toy sequence. */
type TestMathNode = TestNode & {
  /** Narrowed so the pass can hand a formula back typed. */
  kind: 'math'
}

/** A node of the toy sequence that only wraps the prose it holds, as a bold run does. */
type TestWrapperNode = TestNode & {
  /** Narrowed so the pass can walk the run without asking again. */
  children: TestNode[]
}

/** Reads the toy sequence the way each real renderer reads its own tree. */
const TEST_READER: MathGlueReader<TestNode, TestMathNode, TestWrapperNode> = {
  isInlineMath: (node): node is TestMathNode => node.kind === 'math',
  readText: (node) => (node.kind === 'text' ? node.value : null),
  isWrapper: (node): node is TestWrapperNode => node.children !== undefined,
  readChildren: (wrapper) => wrapper.children,
}

/** Builds a prose node. */
function text(value: string): TestNode {
  return { kind: 'text', value }
}

/** Builds a formula node. */
function math(value: string): TestNode {
  return { kind: 'math', value }
}

/** Builds a node the reader reads no prose from, as it does a display formula or a list. */
function other(value: string): TestNode {
  return { kind: 'other', value }
}

/** Builds a node that only wraps the prose it holds, as a bold run does. */
function wrapper(children: TestNode[]): TestNode {
  return { kind: 'other', value: 'wrapper', children }
}

describe('planMathGlue', () => {
  it('pulls a trailing comma onto the formula', () => {
    // A formula written mid-sentence, with the comma written straight after it
    const results = planMathGlue([text('od zvyšku '), math('k'), text(', je')], TEST_READER)

    // The comma travels with the formula, and the space after it stays behind
    expect(results).toEqual([
      { kind: 'trimmed', node: text('od zvyšku '), text: 'od zvyšku ' },
      { kind: 'glued', math: math('k'), glue: { leading: '', trailing: ',' } },
      { kind: 'trimmed', node: text(', je'), text: ' je' },
    ])
  })

  it('pulls a leading bracket onto the formula', () => {
    // A formula opening a bracketed aside
    const results = planMathGlue([text('interval ('), math('a'), text(')')], TEST_READER)

    // The bracket on each side hugs the formula
    expect(results[1]).toEqual({
      kind: 'glued',
      math: math('a'),
      glue: { leading: '(', trailing: ')' },
    })
  })

  it('splits text shared by two formulas', () => {
    // Two formulas separated by a comma and a space
    const results = planMathGlue([math('a'), text(', '), math('b')], TEST_READER)

    // The first formula takes the comma; the second finds only the space left
    expect(results[0]).toMatchObject({ glue: { trailing: ',' } })
    expect(results[1]).toEqual({ kind: 'trimmed', node: text(', '), text: ' ' })
    expect(results[2]).toMatchObject({ glue: { leading: '' } })
  })

  it('claims nothing for a formula standing alone', () => {
    // A formula with no prose on either side of it
    const results = planMathGlue([math('x')], TEST_READER)

    // Nothing to hold on to, but the formula is still reported as glued
    expect(results).toEqual([
      { kind: 'glued', math: math('x'), glue: { leading: '', trailing: '' } },
    ])
  })

  it('leaves a sequence with no formula untouched', () => {
    // Prose split across two nodes, as a rendered tree often has it
    const results = planMathGlue([text('celkom '), text('obyčajná veta')], TEST_READER)

    // Every node comes back as it went in
    expect(results).toEqual([
      { kind: 'unchanged', node: text('celkom ') },
      { kind: 'unchanged', node: text('obyčajná veta') },
    ])
  })

  it('leaves a neighbour it can read no prose from unchanged', () => {
    // A formula between two nodes the reader answers null for, as a display formula or a list is
    const results = planMathGlue([other('display'), math('x'), other('list')], TEST_READER)

    // Both neighbours have to stay unchanged: a caller tells a block-level node apart by that alone,
    // so reporting one as trimmed would render it as the empty prose a trimmed node carries
    expect(results[0]).toEqual({ kind: 'unchanged', node: other('display') })
    expect(results[2]).toEqual({ kind: 'unchanged', node: other('list') })
  })

  it('hands a formula ending a wrapping run the punctuation written after the run', () => {
    // A bolded formula with the sentence's period written outside the bold, as markdown has it
    const results = planMathGlue([wrapper([math('x')]), text('. more')], TEST_READER)

    // The period has to render inside the run, next to the formula it belongs to
    expect(results[0]).toEqual({
      kind: 'wrapper',
      node: wrapper([math('x')]),
      children: [{ kind: 'glued', math: math('x'), glue: { leading: '', trailing: '.' } }],
    })
    expect(results[1]).toEqual({ kind: 'trimmed', node: text('. more'), text: ' more' })
  })

  it('reaches past prose a formula inside the run already emptied', () => {
    // A run whose own period the formula in it took, leaving nothing rendered behind the formula
    const results = planMathGlue([wrapper([math('x'), text('.')]), text(', more')], TEST_READER)

    // The comma written after the run joins the period the formula already holds
    expect(results[0]).toMatchObject({
      children: [{ glue: { trailing: '.,' } }, { kind: 'trimmed', text: '' }],
    })
  })

  it('leaves a word written against a wrapping run outside it', () => {
    // A bolded formula the prose runs straight on from, with no space to break the word off at
    const results = planMathGlue([wrapper([math('p')]), text('-tica ďalej')], TEST_READER)

    // The word stays outside the bold, where the author wrote it
    expect(results[0]).toMatchObject({ children: [{ glue: { trailing: '' } }] })
    expect(results[1]).toEqual({ kind: 'unchanged', node: text('-tica ďalej') })
  })

  it('leaves a word written against the front of a wrapping run outside it', () => {
    // Prose running straight into a bolded formula, with no space to break the word off at
    const results = planMathGlue([text('pred'), wrapper([math('p')])], TEST_READER)

    // The word stays outside the bold, where the author wrote it
    expect(results[0]).toEqual({ kind: 'unchanged', node: text('pred') })
    expect(results[1]).toMatchObject({ children: [{ glue: { leading: '' } }] })
  })

  it('claims nothing for a wrapping run that ends in prose', () => {
    // A run whose formula sits at its start, with prose written after it
    const results = planMathGlue(
      [wrapper([math('x'), text(' and more')]), text('. end')],
      TEST_READER
    )

    // Moving the period next to that formula would render it mid-run, so it stays where it was
    expect(results[0]).toMatchObject({
      children: [{ glue: { trailing: '' } }, { kind: 'trimmed', text: ' and more' }],
    })
    expect(results[1]).toEqual({ kind: 'unchanged', node: text('. end') })
  })

  it('leaves the input nodes untouched', () => {
    // The same sequence the first case glues, kept for comparison
    const nodes = [text('interval ('), math('a'), text(', b)')]

    // Run the pass, which reports what it would take without taking it
    planMathGlue(nodes, TEST_READER)

    // The caller's own nodes still read exactly as they did
    expect(nodes).toEqual([text('interval ('), math('a'), text(', b)')])
  })
})
