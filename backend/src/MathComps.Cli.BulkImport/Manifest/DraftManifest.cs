using System.Collections.Immutable;
using MathComps.Domain.Localization;

namespace MathComps.Cli.BulkImport.Manifest;

/// <summary>
/// The whole output of the TS preflight (<c>web/scripts/preflight-draft.ts</c>), deserialized from its
/// <c>--json</c> stdout — the manifest mirroring <c>preflight-draft-types.ts</c>. The preflight owns the entire
/// draft-format read (folder walk, per-problem metadata, sentinel split, <c>validateMarkdown</c>, image-ref
/// resolution) and emits this; the draft format is never parsed twice.
/// </summary>
/// <param name="Meta">Folder-level taxonomy parsed from <c>_meta.yaml</c>.</param>
/// <param name="Problems">One entry per problem, ordered by problem number.</param>
/// <param name="Verdict">The collected issues; pass/fail is derived from their severities.</param>
public record DraftManifest(
    ManifestMeta Meta,
    ImmutableArray<ManifestProblem> Problems,
    Verdict Verdict)
{
    /// <summary>
    /// Whether the taxonomy can be resolved from this manifest — true once the metadata carries a competition
    /// slug. A blank competition is the fallback the preflight emits when it can't read one (and it has already
    /// reported that), so the registry and DB-preview checks would have nothing to resolve against.
    /// </summary>
    public bool IsMetadataUsable => !string.IsNullOrWhiteSpace(Meta.Competition);
}

/// <summary>
/// Folder-level taxonomy from <c>_meta.yaml</c>. References slugs only — display names live in the registry.
/// </summary>
/// <param name="Competition">Competition slug (e.g. <c>csmo</c>).</param>
/// <param name="Category">Category slug (e.g. <c>a</c>), or null when the competition has no categories.</param>
/// <param name="Round">Round slug (e.g. <c>iii</c>), or null for a competition whose single round is the default (e.g. IMO).</param>
/// <param name="Season">The season the draft belongs to.</param>
/// <param name="Date">Round-instance date as <c>YYYY-MM-DD</c>; approximate is fine since it's a sort key.</param>
/// <param name="Language">The original language of the draft — the text variant in it is the original.</param>
public record ManifestMeta(
    string Competition,
    string? Category,
    string? Round,
    ManifestSeason Season,
    string Date,
    Language Language)
{
    /// <summary>
    /// The draft's folder-level metadata file name, used to attribute file-level issues to it.
    /// </summary>
    public const string FileName = "_meta.yaml";
}

/// <summary>
/// The season a draft belongs to.
/// </summary>
/// <param name="Year">Calendar year the season starts in (e.g. 2024 for the 2024/2025 season).</param>
public record ManifestSeason(int Year);

/// <summary>
/// One language variant of a problem — the original or a translation, with its statement/solution markdown
/// carried verbatim.
/// </summary>
/// <param name="Language">The text's language, from its <c>pN.&lt;lang&gt;.md</c> filename.</param>
/// <param name="Original">
/// <c>true</c> for the original (its language matches <see cref="ManifestMeta.Language"/>), <c>false</c> for a
/// translation. Maps 1:1 to <c>ProblemText.IsOriginal</c>.
/// </param>
/// <param name="StatementMarkdown">Statement markdown verbatim, still carrying relative <c>images/…</c> refs.</param>
/// <param name="SolutionMarkdown">Solution markdown verbatim, or null when this text has no solution sentinel.</param>
public record ManifestText(
    Language Language,
    bool Original,
    string StatementMarkdown,
    string? SolutionMarkdown);

/// <summary>
/// One draft problem: its language-invariant metadata plus one text variant per language (original first).
/// </summary>
/// <param name="Order">1-based position within the round, taken from the filenames.</param>
/// <param name="Authors">
/// Author display names in declared order, or null when the <c>pN.yaml</c> omits an <c>authors:</c> key. Null leaves
/// existing authors untouched; an empty array clears them; a populated array replaces them — so omit is distinct from
/// clear.
/// </param>
/// <param name="SolutionLink">External solution URL, or null when absent.</param>
/// <param name="Tags">
/// Tag slugs to assign, or null when the <c>pN.yaml</c> omits a <c>tags:</c> key. Null leaves existing tags untouched;
/// an empty array clears them; a populated array replaces them — so omit is distinct from clear.
/// </param>
/// <param name="Texts">The language variants — the original first, then translations.</param>
/// <param name="Images">Basenames of every image referenced across the texts (flat, under <c>images/</c>).</param>
public record ManifestProblem(
    int Order,
    ImmutableArray<string>? Authors,
    string? SolutionLink,
    ImmutableArray<string>? Tags,
    ImmutableArray<ManifestText> Texts,
    ImmutableArray<string> Images);

/// <summary>
/// The pass/fail decision and its supporting issues. Pass/fail is derived: a run passes only when nothing in
/// <see cref="Errors"/> reaches <see cref="VerdictSeverity.Error"/> severity.
/// </summary>
/// <param name="Errors">Every error and warning found, in deterministic file order.</param>
public record Verdict(ImmutableArray<VerdictError> Errors);

/// <summary>
/// A single issue — the canonical issue shape for the whole run. Registry and DB findings reuse it too (with
/// <see cref="File"/> = <c>_meta.yaml</c> and a null <see cref="Half"/>), so one report covers every problem.
/// </summary>
/// <param name="File">File the issue was found in (e.g. <c>p1.md</c> or <c>_meta.yaml</c>).</param>
/// <param name="Half">Half the issue belongs to, or null for file-level issues.</param>
/// <param name="Line">1-based source line, or null when the issue carries no position.</param>
/// <param name="Col">1-based source column, or null when the issue carries no position.</param>
/// <param name="Rule">
/// Machine-readable issue category (e.g. <c>katex</c>, <c>missing-image</c>, <c>registry</c>).
/// </param>
/// <param name="Message">Human-readable description.</param>
/// <param name="Severity">Whether the issue blocks import or is advisory.</param>
public record VerdictError(
    string File,
    ProblemHalf? Half,
    int? Line,
    int? Col,
    string Rule,
    string Message,
    VerdictSeverity Severity);

/// <summary>
/// Which half of a problem an issue belongs to. Serialized lowercase to match the TS manifest.
/// </summary>
public enum ProblemHalf
{
    // ReSharper disable once UnusedMember.Global
    /// <summary>The problem statement.</summary>
    Statement,

    // ReSharper disable once UnusedMember.Global
    /// <summary>The problem solution.</summary>
    Solution
}

/// <summary>
/// Whether an issue blocks import or is merely advisory. Serialized lowercase to match the TS manifest.
/// </summary>
public enum VerdictSeverity
{
    /// <summary>Blocks import — any such issue fails the run.</summary>
    Error,

    /// <summary>Advisory only — does not fail the run (e.g. an orphaned image).</summary>
    Warning
}
