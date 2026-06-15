using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// One language variant a draft problem imports: its language, whether it is the original, and the statement /
/// solution markdown carried verbatim (still with relative <c>images/…</c> refs). Carries the content to write,
/// shared by both the read-only preview and the apply path.
/// </summary>
/// <param name="Language">The text's language.</param>
/// <param name="Original">Whether this text is the original (maps 1:1 to
/// <see cref="ProblemText.IsOriginal"/>).</param>
/// <param name="StatementMarkdown">Statement markdown verbatim.</param>
/// <param name="SolutionMarkdown">Solution markdown verbatim, or null when this text has no solution.</param>
public record DraftTextContent(
    Language Language,
    bool Original,
    string StatementMarkdown,
    string? SolutionMarkdown);

/// <summary>
/// Everything needed to write one draft problem: its position and language-invariant facts (authors, solution
/// link, the shared image basenames) plus every language variant's content. A small Infrastructure contract,
/// independent of the preflight manifest shape.
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
/// <param name="Texts">The language variants this problem imports — the original plus any translations.</param>
/// <param name="Images">Basenames of every image referenced across the texts (flat, under <c>images/</c>).</param>
public record DraftProblemContent(
    int Order,
    bool HasSidecar,
    ImmutableArray<string>? Authors,
    string? SolutionLink,
    ImmutableArray<string>? Tags,
    ImmutableArray<DraftTextContent> Texts,
    ImmutableArray<string> Images);
