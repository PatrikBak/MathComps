using System.Collections.Immutable;
using MathComps.TexParser.Types;

namespace MathComps.TexParser;

/// <summary>
/// The result of transforming a <see cref="ContentBlock"/> node during tree traversal.
/// </summary>
/// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
/// <param name="Node">The transformed node, or null to remove the node from the tree.</param>
/// <param name="State">The updated state after transformation.</param>
public readonly record struct NodeTransformResult<TState>(ContentBlock? Node, TState State);

/// <summary>
/// A function that transforms a <see cref="ContentBlock"/> node during tree traversal.
/// Return the same node reference to indicate no change.
/// Return null in <see cref="NodeTransformResult{TState}.Node"/> to remove the node from the tree.
/// </summary>
/// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
/// <param name="node">The current node being visited.</param>
/// <param name="state">The current accumulated state.</param>
/// <returns>A <see cref="NodeTransformResult{TState}"/> with the transformed node and updated state.</returns>
public delegate NodeTransformResult<TState> NodeTransformer<TState>(ContentBlock node, TState state);

/// <summary>
/// Provides utilities for traversing and transforming <see cref="ContentBlock"/> trees.
/// The core method <see cref="Traverse{TState}"/> supports both tree transformations and
/// data collection in a single pass, using a functional "map-accumulate" pattern.
/// <para>
/// Key features:
/// <list type="bullet">
/// <item>Recursively visits all nodes in the tree, including nested containers.</item>
/// <item>Allows transformation of nodes via a user-defined transformer function.</item>
/// <item>Threads state through the traversal for accumulating data.</item>
/// <item>Uses reference equality optimization to avoid allocations when nodes are unchanged.</item>
/// </list>
/// </para>
/// </summary>
public static class ContentTree
{
    #region Public API

    /// <summary>
    /// Traverses a content tree, transforming nodes and accumulating state.
    /// The transformer function is called for each node after its children have been processed.
    /// </summary>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="blocks">The content blocks to traverse.</param>
    /// <param name="initialState">The initial state value.</param>
    /// <param name="transformer">The transformation function applied to each node.</param>
    /// <returns>A tuple containing the transformed tree and the final state.</returns>
    public static (ImmutableList<ContentBlock> Blocks, TState State) Traverse<TState>(
        ImmutableList<ContentBlock> blocks,
        TState initialState,
        NodeTransformer<TState> transformer
    )
    {
        // Delegate to the internal method that also tracks whether anything changed.
        var (result, state, _) = TraverseList(blocks, initialState, transformer);

        // Return only the result and final state (caller doesn't need the changed flag).
        return (result, state);
    }

    /// <summary>
    /// Simplified overload for pure transformations that don't need to accumulate state.
    /// </summary>
    /// <param name="blocks">The content blocks to traverse.</param>
    /// <param name="transformer">A function that transforms each node. Return the same reference for no change. Return null to remove the node from the tree.</param>
    /// <returns>The transformed tree.</returns>
    public static ImmutableList<ContentBlock> Map(
        ImmutableList<ContentBlock> blocks,
        Func<ContentBlock, ContentBlock?> transformer
    )
    {
        // Use a dummy unit state since we don't need state accumulation.
        var (result, _) = Traverse(blocks, 0, (node, state) => new NodeTransformResult<int>(transformer(node), state));

        // Return only the transformed blocks.
        return result;
    }

    #endregion

    #region Internal Traversal

    /// <summary>
    /// Represents the result of traversing a content block or list of blocks.
    /// Captures the transformed node, the updated state, and whether anything changed.
    /// </summary>
    /// <typeparam name="TNode">The type of the result node.</typeparam>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="Node">The (possibly transformed) node.</param>
    /// <param name="State">The updated state after processing.</param>
    /// <param name="Changed">Whether this node or any of its children were modified.</param>
    private record TraversalResult<TNode, TState>(TNode Node, TState State, bool Changed);

    /// <summary>
    /// Traverses a single content block node. First processes children recursively,
    /// then applies the transformer to the (possibly updated) node.
    /// </summary>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="block">The block to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseNode<TState>(
        ContentBlock block,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // First, recursively process any children this node might have.
        // The result is a potentially-updated node and whether any children changed.
        var (processedBlock, newState, childrenChanged) = block switch
        {
            #region Simple containers with a single Content property.

            Paragraph paragraph => TraverseContainer(paragraph, paragraph.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            BoldText bold => TraverseContainer(bold, bold.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            ItalicText italic => TraverseContainer(italic, italic.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            QuoteText quote => TraverseContainer(quote, quote.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            Footnote footnote => TraverseContainer(footnote, footnote.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            Link link => TraverseContainer(link, link.Content, state, transformer,
                (node, newContent) => node with { Content = newContent }),

            #endregion

            #region ItemList

            ItemList list => TraverseItemList(list, state, transformer),

            #endregion

            #region Complex blocks with multiple content properties.

            Theorem theorem => TraverseTheorem(theorem, state, transformer),
            Exercise exercise => TraverseExercise(exercise, state, transformer),
            Problem problem => TraverseProblem(problem, state, transformer),
            Example example => TraverseExample(example, state, transformer),
            Definition definition => TraverseDefinition(definition, state, transformer),

            #endregion

            #region Leaf nodes have no children to process.

            _ => new TraversalResult<ContentBlock?, TState>(block, state, false)

            #endregion
        };

        // If children processing returned null, propagate that.
        if (processedBlock is null)
            return new(null, newState, true);

        // Now apply the user's transformer to the (possibly updated) node.
        var (result, finalState) = transformer(processedBlock, newState);

        // Determine if anything changed: either children changed, transformer modified the node, or node was removed.
        var nodeChanged = childrenChanged || result is null || !ReferenceEquals(result, processedBlock);

        // Return the final result (may be null to indicate removal).
        return new(result, finalState, nodeChanged);
    }

    /// <summary>
    /// Traverses a list of content blocks, tracking whether anything changed.
    /// If no nodes are modified, returns the original list reference to avoid allocations.
    /// </summary>
    /// <typeparam name="TItem">The type of content block in the list.</typeparam>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="items">The list of blocks to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result list.</returns>
    private static TraversalResult<ImmutableList<TItem>, TState> TraverseList<TItem, TState>(
        ImmutableList<TItem> items,
        TState state,
        NodeTransformer<TState> transformer
    ) where TItem : ContentBlock
    {
        // Track whether any node in the list was modified.
        var anyChanged = false;

        // Build up the result list as we go.
        var builder = ImmutableList.CreateBuilder<TItem>();

        // Process each block in sequence, threading state through.
        foreach (var item in items)
        {
            // Recursively traverse this node and its children.
            var (newItem, newState, changed) = TraverseNode(item, state, transformer);

            // Update state for the next iteration.
            state = newState;

            // If the transformer returned null, skip this item (i.e., remove it from the tree).
            if (newItem is null)
            {
                anyChanged = true;
                continue;
            }

            // The transformer should return the same type TItem.
            if (newItem is not TItem typedItem)
                throw new InvalidOperationException($"Transformer returned {newItem.GetType().Name} but expected {typeof(TItem).Name}");

            // If this node or any of its children changed, mark the list as changed.
            if (changed)
                anyChanged = true;

            // Add to the result builder.
            builder.Add(typedItem);
        }

        // Optimization: if nothing changed, return the original list reference.
        // This avoids allocations for pure "collect" operations.
        return anyChanged
            ? new(builder.ToImmutable(), state, true)
            : new(items, state, false);
    }

    #endregion

    #region Container Helpers

    /// <summary>
    /// Helper for traversing simple container nodes that have a single Content list.
    /// </summary>
    /// <typeparam name="TContainer">The type of the container node.</typeparam>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="container">The container node to traverse.</param>
    /// <param name="content">The content list to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <param name="reconstruct">Function to reconstruct the container with new content.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseContainer<TContainer, TState>(
        TContainer container,
        ImmutableList<RawContentBlock> content,
        TState state,
        NodeTransformer<TState> transformer,
        Func<TContainer, ImmutableList<RawContentBlock>, TContainer> reconstruct
    ) where TContainer : ContentBlock
    {
        // Traverse the content list.
        var (newContent, newState, changed) = TraverseList(content, state, transformer);

        // Only reconstruct the container if something changed.
        var result = changed
            ? reconstruct(container, newContent)
            : container;

        // Return the result, final state, and whether anything changed downstream.
        return new TraversalResult<ContentBlock?, TState>(result, newState, changed);
    }

    /// <summary>
    /// Traverses an <see cref="ItemList" />, which contains a list of items where
    /// each item is a list of blocks.
    /// </summary>
    /// <param name="list">The list to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseItemList<TState>(
        ItemList list,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Track whether any item changed.
        var anyChanged = false;
        var itemsBuilder = ImmutableList.CreateBuilder<ImmutableList<RawContentBlock>>();

        // Process each item
        foreach (var item in list.Items)
        {
            // Each item is itself a list of blocks.
            var (newItem, newState, changed) = TraverseList(item, state, transformer);

            // If this item or any of its children changed, mark the list as changed.
            if (changed)
                anyChanged = true;

            // Add to the result builder and update the state for the next iteration.
            itemsBuilder.Add(newItem);
            state = newState;
        }

        // Reconstruct only if changed.
        var result = anyChanged
            ? list with { Items = itemsBuilder.ToImmutable() }
            : list;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses a <see cref="Theorem" /> block with Title, Body, and Proof properties.
    /// </summary>
    /// <param name="theorem">The theorem to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseTheorem<TState>(
        Theorem theorem,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Process optional title.
        (var newTitle, state, var titleChanged) = TraverseOptional(theorem.Title, state, transformer);

        // Process body.
        (var newBody, state, var bodyChanged) = TraverseList(theorem.Body, state, transformer);

        // Process proof.
        (var newProof, state, var proofChanged) = TraverseList(theorem.Proof, state, transformer);

        // Determine if anything changed.
        var anyChanged = titleChanged || bodyChanged || proofChanged;

        // Reconstruct only if needed.
        var result = anyChanged
            ? theorem with
            {
                Title = newTitle,
                Body = newBody,
                Proof = newProof
            }
            : theorem;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses an <see cref="Exercise" /> block with Title, Body, and Solution properties.
    /// </summary>
    /// <param name="exercise">The exercise to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseExercise<TState>(
        Exercise exercise,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Process optional title.
        (var newTitle, state, var titleChanged) = TraverseOptional(exercise.Title, state, transformer);

        // Process body.
        (var newBody, state, var bodyChanged) = TraverseList(exercise.Body, state, transformer);

        // Process the optional answer.
        (var newAnswer, state, var answerChanged) = TraverseOptionalList(exercise.Answer, state, transformer);

        // Process solution.
        (var newSolution, state, var solutionChanged) = TraverseList(exercise.Solution, state, transformer);

        // Determine if anything changed.
        var anyChanged = titleChanged || bodyChanged || answerChanged || solutionChanged;

        // Reconstruct only if needed.
        var result = anyChanged
            ? exercise with
            {
                Title = newTitle,
                Body = newBody,
                Answer = newAnswer,
                Solution = newSolution
            }
            : exercise;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses a <see cref="Problem" /> block with Title, Body, Hints (list of lists), and Solution.
    /// </summary>
    /// <param name="problem">The problem to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseProblem<TState>(
        Problem problem,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Process optional title.
        (var newTitle, state, var titleChanged) = TraverseOptional(problem.Title, state, transformer);

        // Process body.
        (var newBody, state, var bodyChanged) = TraverseList(problem.Body, state, transformer);

        // Let's build the hints list.
        var hintsBuilder = ImmutableList.CreateBuilder<ImmutableList<RawContentBlock>>();

        // We'll track if any of the hints changed.
        var hintsChanged = false;

        // Let's traverse each hint.
        foreach (var hint in problem.Hints)
        {
            // Let's traverse the hint.
            (var newHint, state, var hintChanged) = TraverseList(hint, state, transformer);

            // Let's track if the hint changed.
            if (hintChanged)
                hintsChanged = true;

            // Remember the new hint.
            hintsBuilder.Add(newHint);
        }

        // Process the optional answer.
        (var newAnswer, state, var answerChanged) = TraverseOptionalList(problem.Answer, state, transformer);

        // Process solution.
        (var newSolution, state, var solutionChanged) = TraverseList(problem.Solution, state, transformer);

        // Determine if anything changed.
        var anyChanged = titleChanged || bodyChanged || hintsChanged || answerChanged || solutionChanged;

        // Reconstruct only if needed.
        var result = anyChanged
            ? problem with
            {
                Title = newTitle,
                Body = newBody,
                Hints = hintsBuilder.ToImmutable(),
                Answer = newAnswer,
                Solution = newSolution
            }
            : problem;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses an <see cref="Example" /> block with Title, Body, and Solution properties.
    /// </summary>
    /// <param name="example">The example to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseExample<TState>(
        Example example,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Process optional title.
        (var newTitle, state, var titleChanged) = TraverseOptional(example.Title, state, transformer);

        // Process body.
        (var newBody, state, var bodyChanged) = TraverseList(example.Body, state, transformer);

        // Process the optional answer.
        (var newAnswer, state, var answerChanged) = TraverseOptionalList(example.Answer, state, transformer);

        // Process solution.
        (var newSolution, state, var solutionChanged) = TraverseList(example.Solution, state, transformer);

        // Determine if anything changed.
        var anyChanged = titleChanged || bodyChanged || answerChanged || solutionChanged;

        // Reconstruct only if needed.
        var result = anyChanged
            ? example with
            {
                Title = newTitle,
                Body = newBody,
                Answer = newAnswer,
                Solution = newSolution
            }
            : example;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses a <see cref="Definition" /> block with Title and Body properties.
    /// </summary>
    /// <param name="definition">The definition to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<ContentBlock?, TState> TraverseDefinition<TState>(
        Definition definition,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // Process optional title.
        (var newTitle, state, var titleChanged) = TraverseOptional(definition.Title, state, transformer);

        // Process body.
        (var newBody, state, var bodyChanged) = TraverseList(definition.Body, state, transformer);

        // Determine if anything changed.
        var anyChanged = titleChanged || bodyChanged;

        // Reconstruct only if needed.
        var result = anyChanged
            ? definition with
            {
                Title = newTitle,
                Body = newBody,
            }
            : definition;

        // Return the result, final state, and whether anything changed downstream.
        return new(result, state, anyChanged);
    }

    /// <summary>
    /// Traverses an optional <see cref="RawContentBlock" /> (used for Title fields that can be null).
    /// </summary>
    /// <param name="block">The block to traverse.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result.</returns>
    private static TraversalResult<RawContentBlock?, TState> TraverseOptional<TState>(
        RawContentBlock? block,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // If null, nothing to traverse.
        if (block is null)
            return new(null, state, false);

        // Traverse the block.
        var (newBlock, newState, changed) = TraverseNode(block, state, transformer);

        // If null, the block was removed.
        if (newBlock is null)
            return new(null, newState, true);

        // Ensure result is still a raw content block.
        return newBlock is not RawContentBlock rawResult
            ? throw new InvalidOperationException($"Transformer returned {newBlock.GetType().Name} but expected {nameof(RawContentBlock)}")
            : new(rawResult, newState, changed);
    }

    /// <summary>
    /// Traverses an optional list of blocks, leaving a null list untouched. Used for fields like a
    /// problem's answer that are null when absent.
    /// </summary>
    /// <typeparam name="TState">The type of state threaded through the traversal.</typeparam>
    /// <param name="items">The optional list of blocks, or null when absent.</param>
    /// <param name="state">The current state.</param>
    /// <param name="transformer">The transformation function.</param>
    /// <returns>A <see cref="TraversalResult{TNode, TState}"/> containing the result list (or null).</returns>
    private static TraversalResult<ImmutableList<RawContentBlock>?, TState> TraverseOptionalList<TState>(
        ImmutableList<RawContentBlock>? items,
        TState state,
        NodeTransformer<TState> transformer
    )
    {
        // A null list carries no content to traverse.
        if (items is null)
            return new(null, state, false);

        // Traverse it like any other block list. The ! silences CS8619: TraversalResult is invariant
        // in its node type, so the non-nullable list result doesn't implicitly widen to this method's
        // nullable-node return type, even though the value is fine.
        return TraverseList(items, state, transformer)!;
    }

    #endregion
}
