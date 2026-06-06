using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// One language variant a draft problem imports: its language, whether it is the original, and the statement /
/// solution markdown carried verbatim (still with relative <c>images/…</c> refs). The apply-side counterpart to
/// the preview's lighter <see cref="DraftTextRef"/>: it carries the content to write, not just the shape to
/// classify.
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
/// <param name="Authors">Author display names in declared order.</param>
/// <param name="SolutionLink">External solution URL, or null when absent.</param>
/// <param name="Texts">The language variants this problem imports — the original plus any translations.</param>
/// <param name="Images">Basenames of every image referenced across the texts (flat, under <c>images/</c>).</param>
public record DraftProblemContent(
    int Order,
    ImmutableArray<string> Authors,
    string? SolutionLink,
    ImmutableArray<DraftTextContent> Texts,
    ImmutableArray<string> Images);
