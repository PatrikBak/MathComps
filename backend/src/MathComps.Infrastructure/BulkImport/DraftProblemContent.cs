using System.Collections.Immutable;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.Selection;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// One language variant a draft problem imports: its language, whether it is the original, and the statement,
/// solution and hint markdown carried verbatim (still with relative <c>images/…</c> refs). Carries the content to
/// write, shared by both the read-only preview and the apply path.
/// </summary>
/// <param name="Language">The text's language.</param>
/// <param name="Original">Whether this text is the original (maps 1:1 to
/// <see cref="ProblemText.IsOriginal"/>).</param>
/// <param name="StatementMarkdown">Statement markdown verbatim.</param>
/// <param name="SolutionMarkdown">Solution markdown verbatim, or null when this text has no solution.</param>
/// <param name="Hints">The author's hints, weakest nudge first, each verbatim; empty when this text has none.</param>
public record DraftTextContent(
    Language Language,
    bool Original,
    string StatementMarkdown,
    string? SolutionMarkdown,
    ImmutableArray<string> Hints)
{
    /// <summary>
    /// The halves this text writes, each with the markdown stored for it: the statement always, the solution and the
    /// hints when the draft carries them.
    /// </summary>
    /// <param name="replacements">The image-ref replacements the bodies are rewritten against.</param>
    /// <returns>Each half's document type and the markdown it stores.</returns>
    public IEnumerable<(DocumentType DocumentType, string Markdown)> HalvesToWrite(
        IReadOnlyDictionary<string, ResolvedImageRef> replacements)
    {
        // The statement half.
        yield return (DocumentType.Statement, MarkdownImageRewriter.Rewrite(StatementMarkdown, replacements));

        // The solution half, only when the draft carries one.
        if (SolutionMarkdown is { } solutionMarkdown)
            yield return (DocumentType.Solution, MarkdownImageRewriter.Rewrite(solutionMarkdown, replacements));

        // The hints, as the one document they are stored in, only when the draft carries any.
        if (HintsDocument.Join(Hints) is { } hintsDocument)
            yield return (DocumentType.Hints, MarkdownImageRewriter.Rewrite(hintsDocument, replacements));
    }
}

/// <summary>
/// Everything needed to write one draft problem: its position and language-invariant facts plus every language
/// variant's content.
/// </summary>
/// <param name="Order">1-based position within the round, taken from the filenames.</param>
/// <param name="HasSidecar">
/// Whether a <c>pN.yaml</c> sidecar exists for this problem. A newly-created problem with no sidecar is flagged (it
/// forgot its metadata); a re-import onto an existing problem may omit it (omit = leave the stored values untouched).
/// </param>
/// <param name="Authors">
/// Author display names in declared order, or null when the draft omits an <c>authors:</c> key. Null leaves existing
/// authors untouched; an empty array clears them; a populated array replaces them.
/// </param>
/// <param name="SolutionLink">
/// External solution URL, or null when the draft omits a <c>solutionLink:</c> key. Null leaves an existing link
/// untouched; a populated value sets it. 
/// </param>
/// <param name="Tags">
/// Tag slugs to assign, or null when the draft omits a <c>tags:</c> key. Null leaves existing tags untouched; an
/// empty array clears them; a populated array replaces them.
/// </param>
/// <param name="Proposal">
/// What the problem is filed under in the pool, or null when the draft carries no <c>proposal:</c> block. Null
/// leaves a stored proposal untouched.
/// </param>
/// <param name="Texts">The language variants this problem imports — the original plus any translations.</param>
/// <param name="Images">Basenames of every image referenced across the texts (flat, under <c>images/</c>).</param>
public record DraftProblemContent(
    int Order,
    bool HasSidecar,
    ImmutableArray<string>? Authors,
    string? SolutionLink,
    ImmutableArray<string>? Tags,
    DraftProposal? Proposal,
    ImmutableArray<DraftTextContent> Texts,
    ImmutableArray<string> Images)
{
    /// <summary>
    /// Why the import refuses to create this problem when its slug is new, or null when it may: a new problem needs an
    /// original body, so it has a canonical text, and a <c>pN.yaml</c> declaring its metadata.
    /// </summary>
    public DraftTextAction? CreateConflict =>
        // No original among the texts, an empty draft included
        !Texts.Any(text => text.Original) ? DraftTextAction.NoOriginalForNewProblem
        // No metadata file
        : !HasSidecar ? DraftTextAction.NewProblemMissingMetadata
        // Nothing in the way
        : null;
}

/// <summary>
/// What a draft files a pool problem under: the fields its <see cref="Proposal"/> row is written from.
/// </summary>
/// <param name="Number"><inheritdoc cref="Proposal.Number" path="/summary"/></param>
/// <param name="Title"><inheritdoc cref="Proposal.Title" path="/summary"/></param>
/// <param name="Area"><inheritdoc cref="Proposal.Area" path="/summary"/></param>
/// <param name="Recommended">The categories the problem is recommended for, in any order.</param>
public record DraftProposal(
    int Number,
    string Title,
    ProposalArea Area,
    ImmutableArray<HostedCompetitionCategory> Recommended)
{
    /// <summary>
    /// Whether a stored proposal already holds everything a re-import writes from this block: its title, its area
    /// and its categories.
    /// </summary>
    /// <param name="stored">The proposal filing the problem the block re-imports.</param>
    /// <returns>True when a re-import would leave the proposal as it is.</returns>
    public bool Matches(Proposal stored) =>
        // The same title and area, recommended for the same categories, which a proposal keeps in category order
        stored.Title == Title
        && stored.Area == Area
        && stored.Recommended.SequenceEqual(SelectionRules.InCategoryOrder(Recommended));
}
