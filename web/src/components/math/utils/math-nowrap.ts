import { assertNever } from '@/components/shared/utils/assert-never'

/**
 * CSS class that pins rendered inline math together with the punctuation hugging
 * it, so neither orphans onto its own line.
 */
export const MATH_NOWRAP_CLASS = 'math-nowrap'

/**
 * A string split into a "glue" run and the text left behind.
 */
type GlueSplit = {
  /** The run to pull toward the adjacent formula (empty when none). */
  glue: string
  /** The remaining text after the glue run is removed. */
  rest: string
}

/**
 * One character of a glue run: anything but a space the line may break at. A
 * non-breaking space counts, since a `~` tie in the source is written precisely
 * to keep the word it joins on the formula's line.
 */
const GLUE_CHARACTER = String.raw`(?:\S|\u00A0)`

/** Matches the glue run a string opens with. */
const LEADING_GLUE_PATTERN = new RegExp(`^${GLUE_CHARACTER}+`)

/** Matches the glue run a string closes with. */
const TRAILING_GLUE_PATTERN = new RegExp(`${GLUE_CHARACTER}+$`)

/**
 * A glue run holding no letters or digits. Bold and italic markup restyles whatever ends up inside
 * it, so only such a run may move in there.
 */
const PUNCTUATION_ONLY_GLUE = /^[^\p{L}\p{N}]+$/u

/**
 * Splits off the leading glue run of a string: the punctuation, tie, or other
 * unbreakable token that hugs the start of the following inline math.
 *
 * @param text - The text immediately after a formula.
 * @returns The leading run as `glue` and everything after it as `rest`.
 */
export function takeLeadingGlue(text: string): GlueSplit {
  // Grab the run at the very start, if any
  const match = LEADING_GLUE_PATTERN.exec(text)

  // Nothing hugging the formula — leave the text whole
  if (!match) {
    return { glue: '', rest: text }
  }

  // Hand back the hugging run and the trailing remainder
  return { glue: match[0], rest: text.slice(match[0].length) }
}

/**
 * Splits off the trailing glue run of a string: the punctuation, tie, or other
 * unbreakable token that hugs the end of the preceding inline math.
 *
 * @param text - The text immediately before a formula.
 * @returns The leading remainder as `rest` and the trailing run as `glue`.
 */
export function takeTrailingGlue(text: string): GlueSplit {
  // Grab the run at the very end, if any
  const match = TRAILING_GLUE_PATTERN.exec(text)

  // Nothing hugging the formula — leave the text whole
  if (!match) {
    return { glue: '', rest: text }
  }

  // Hand back the leading remainder and the hugging run
  return { glue: match[0], rest: text.slice(0, match.index) }
}

/** The runs one inline formula pulls toward itself from its text neighbours. */
type GlueRuns = {
  /** The run taken off the preceding text, such as an opening bracket. */
  leading: string
  /** The run taken off the following text, such as a comma. */
  trailing: string
}

/**
 * How {@link planMathGlue} reads one renderer's node sequence. Each renderer walks a tree of its
 * own (a hast child list, split math segments, a handout content sequence), so every question the
 * pass asks about a node is answered per caller.
 */
export type MathGlueReader<TNode, TMath extends TNode, TWrapper extends TNode> = {
  /** Whether the node is a formula rendered inline with the surrounding prose. */
  isInlineMath: (node: TNode) => node is TMath
  /** The node's prose, or null when it holds none. */
  readText: (node: TNode) => string | null
  /**
   * Whether a formula inside the node may take punctuation written outside it in through the node's
   * markup, which holds for a run that only restyles what it wraps, such as a bold or italic one.
   */
  isWrapper: (node: TNode) => node is TWrapper
  /** The prose a wrapping node holds. */
  readChildren: (wrapper: TWrapper) => readonly TNode[]
}

/** A node the pass had no reason to touch. */
type UnchangedNode<TNode> = {
  /** The discriminator. */
  kind: 'unchanged'
  /** The node, exactly as it came in. */
  node: TNode
}

/** Text a neighbouring formula took a run from. */
type TrimmedText<TNode> = {
  /** The discriminator. */
  kind: 'trimmed'
  /** The node the prose came from. */
  node: TNode
  /** What is left of the prose, which is empty when a formula took all of it. */
  text: string
}

/** An inline formula and the punctuation it claimed. */
type GluedMath<TMath> = {
  /** The discriminator. */
  kind: 'glued'
  /** The formula itself. */
  math: TMath
  /** What has to render on the formula's line, on either side of it. */
  glue: GlueRuns
}

/** A bold or italic run, walked so the formula at its end can claim from outside it. */
type PlannedWrapper<TNode, TMath extends TNode, TWrapper extends TNode> = {
  /** The discriminator. */
  kind: 'wrapper'
  /** The node whose children were walked. */
  node: TWrapper
  /** One entry per child, in the position that child held. */
  children: MathGlueResult<TNode, TMath, TWrapper>[]
}

/** One entry of a {@link planMathGlue} result, in the position its node held. */
export type MathGlueResult<TNode, TMath extends TNode, TWrapper extends TNode> =
  | UnchangedNode<TNode>
  | TrimmedText<TNode>
  | GluedMath<TMath>
  | PlannedWrapper<TNode, TMath, TWrapper>

/** Which end of a run a claim comes from. */
type GlueSide = 'leading' | 'trailing'

/**
 * The formula an entry hands an outside claim to, which for a wrapper is the one at the far end of
 * the run it holds.
 *
 * @param result The entry the claim reached.
 * @param side The end of the run the claim comes from.
 * @returns The claiming formula, or null when that end of the entry is prose.
 */
function claimant<TNode, TMath extends TNode, TWrapper extends TNode>(
  result: MathGlueResult<TNode, TMath, TWrapper>,
  side: GlueSide
): GluedMath<TMath> | null {
  switch (result.kind) {
    // A wrapping run hands the claim on to the formula at its own end
    case 'wrapper':
      return edgeClaimant(result.children, side)
    // A formula claims for itself
    case 'glued':
      return result
    // Prose ends the run, so there is nothing behind it to claim
    case 'unchanged':
    case 'trimmed':
      return null
    default:
      return assertNever(result)
  }
}

/**
 * The formula sitting at one end of a planned run, stepping over prose a formula inside the run
 * already took every character of.
 *
 * @param results The planned run to look into.
 * @param side The end to look from.
 * @returns The formula at that end, or null when prose is there instead.
 */
function edgeClaimant<TNode, TMath extends TNode, TWrapper extends TNode>(
  results: MathGlueResult<TNode, TMath, TWrapper>[],
  side: GlueSide
): GluedMath<TMath> | null {
  // Reading a trailing claim means walking the run from its far end
  const ordered = side === 'leading' ? results : [...results].reverse()

  // Prose a neighbour emptied renders nothing, so it never stands between the end and a formula
  const edge = ordered.find((result) => !(result.kind === 'trimmed' && result.text === ''))

  // An empty run has no end to claim from
  if (edge === undefined) return null

  // Whatever sits at the end answers for the run
  return claimant(edge, side)
}

/**
 * Works out, for a sequence of sibling nodes, which run of text each inline
 * formula has to keep on its own line. A formula renders as an atomic
 * inline, so the browser offers a soft-wrap opportunity on both sides of it and
 * a comma written right after it (or a bracket right before it) can orphan onto
 * a line of its own.
 *
 * Reads only, so the caller emits the nowrap markup the way its own tree allows. Text sitting
 * between two formulas is claimed from the left first and then from the right, so neither formula
 * sees a run the other already took. A bold or italic run is walked in its own right, and the
 * formula at its end claims from outside it, which keeps a period next to a bolded formula.
 *
 * @param nodes The sibling sequence to walk.
 * @param reader How to recognise inline math and read prose in this sequence.
 * @returns One entry per input node, in the same order.
 */
export function planMathGlue<TNode, TMath extends TNode, TWrapper extends TNode>(
  nodes: readonly TNode[],
  reader: MathGlueReader<TNode, TMath, TWrapper>
): MathGlueResult<TNode, TMath, TWrapper>[] {
  // Classify every node first, so the claiming walk below has a whole run to look at
  const results: MathGlueResult<TNode, TMath, TWrapper>[] = nodes.map((node) => {
    // A formula claims for itself, starting out with nothing in hand
    if (reader.isInlineMath(node)) {
      return { kind: 'glued', math: node, glue: { leading: '', trailing: '' } }
    }

    // A bold or italic run is walked in its own right, so a formula at its end can still claim
    if (reader.isWrapper(node)) {
      return { kind: 'wrapper', node, children: planMathGlue(reader.readChildren(node), reader) }
    }

    // Everything else is left exactly as it came in
    return { kind: 'unchanged', node }
  })

  // The prose still available at a position, which is what an earlier claim left there
  const textAt = (index: number): string | null => {
    const result = results[index]

    // Off either end of the run there is no neighbour at all
    if (result === undefined) return null

    // Prose a formula already reached offers what it left behind
    if (result.kind === 'trimmed') return result.text

    // A formula and a walked run hold no prose a neighbour may take
    if (result.kind === 'glued' || result.kind === 'wrapper') return null

    // Prose nothing has reached yet is read straight off the node
    return reader.readText(result.node)
  }

  // Walk left to right, letting each entry take what hugs it before the next one looks
  results.forEach((result, index) => {
    // Which formula, if any, each side of this entry hands a claim to
    const leadingClaimant = claimant(result, 'leading')
    const trailingClaimant = claimant(result, 'trailing')

    // A claim reaching a formula inside a run has to cross that run's own markup
    const crossesRunEdge = result.kind === 'wrapper'

    // The prose written before this entry
    const previous = textAt(index - 1)

    // A formula on this side takes the run hugging the end of that prose
    if (leadingClaimant !== null && previous !== null) {
      // Split the hugging run off
      const { glue, rest } = takeTrailingGlue(previous)

      // Only punctuation may cross a run's own markup
      if (!crossesRunEdge || PUNCTUATION_ONLY_GLUE.test(glue)) {
        // The run goes on the outside of whatever the formula already holds
        leadingClaimant.glue.leading = glue + leadingClaimant.glue.leading

        // What is left of the prose stays in its own position
        results[index - 1] = { kind: 'trimmed', node: nodes[index - 1], text: rest }
      }
    }

    // The prose written after this entry
    const next = textAt(index + 1)

    // A formula on this side takes the run hugging the start of that prose
    if (trailingClaimant !== null && next !== null) {
      // Split the hugging run off
      const { glue, rest } = takeLeadingGlue(next)

      // Only punctuation may cross a run's own markup
      if (!crossesRunEdge || PUNCTUATION_ONLY_GLUE.test(glue)) {
        // The run goes on the outside of whatever the formula already holds
        trailingClaimant.glue.trailing += glue

        // What is left of the prose stays in its own position
        results[index + 1] = { kind: 'trimmed', node: nodes[index + 1], text: rest }
      }
    }
  })

  // One entry per node, each now holding what it claimed
  return results
}
