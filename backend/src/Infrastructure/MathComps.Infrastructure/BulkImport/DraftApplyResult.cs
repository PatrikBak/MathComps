using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// What writing one of the draft's text variants did to the database — the apply-time counterpart to the
/// preview's <see cref="DraftTextAction"/>, collapsed to the outcomes that actually happen once validation has
/// ruled out the conflicts: a fresh row, an in-place rewrite, or a left-alone row whose content already matched.
/// </summary>
public enum AppliedTextAction
{
    /// <summary>A new <see cref="ProblemText"/> row was inserted.</summary>
    Inserted,

    /// <summary>An existing <see cref="ProblemText"/> row's markdown was rewritten in place.</summary>
    Overwritten,

    /// <summary>An existing <see cref="ProblemText"/> row already held this exact markdown, so it was left as-is.</summary>
    Unchanged
}

/// <summary>
/// What the import did to one <c>(problem, document type, language)</c> text.
/// </summary>
/// <param name="Slug">The problem slug the text belongs to.</param>
/// <param name="DocumentType">The half (statement or solution).</param>
/// <param name="Language">The text's language.</param>
/// <param name="Action">Whether the row was inserted or overwritten.</param>
public record AppliedText(
    string Slug,
    DocumentType DocumentType,
    Language Language,
    AppliedTextAction Action);

/// <summary>
/// A summary of what an apply run wrote: which taxonomy entities were created versus reused, what happened to
/// every text, and how many images were uploaded.
/// </summary>
/// <param name="Entities">Create-vs-reuse for the competition, category, round, season and round-instance.</param>
/// <param name="Texts">One entry per statement/solution text written, across all problems and languages.</param>
/// <param name="ProblemsInserted">How many problems were newly created.</param>
/// <param name="ProblemsUpdated">How many existing problems had at least one field actually change.</param>
/// <param name="ProblemsUnchanged">How many existing problems matched the draft exactly, so nothing was written.</param>
/// <param name="ImagesUploaded">How many image objects were uploaded to remote storage.</param>
public record DraftApplyResult(
    ImmutableArray<EntityResolution> Entities,
    ImmutableArray<AppliedText> Texts,
    int ProblemsInserted,
    int ProblemsUpdated,
    int ProblemsUnchanged,
    int ImagesUploaded);
