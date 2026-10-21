using System.Globalization;
using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Services.BulkImport;
using MathComps.Shared.Extensions;

namespace MathComps.Cli.BulkImport.Validation;

/// <summary>
/// Words every reason the database refuses a draft as a <see cref="VerdictError"/>, so the import's refusals read like
/// any preflight error. Each is attributed to the folder's <c>_meta.yaml</c>, since what the database holds has no line
/// in the draft to point at.
/// </summary>
public static class ImportIssues
{
    /// <summary>
    /// Every refusal an import came back with, each as a blocking issue.
    /// </summary>
    /// <param name="outcome">What the import did, or would have done.</param>
    /// <param name="organization">The organization slug the draft names, or null where it names none.</param>
    /// <returns>One issue per refusal, empty when the database takes the draft.</returns>
    public static IReadOnlyList<VerdictError> From(DraftImportOutcome outcome, string? organization) => outcome switch
    {
        // A stored competition node the registry can't place blocks the import — its sort order can't be reconciled,
        // and leaving it risks the very collision the re-sequencing exists to prevent
        DraftImportStoppedAtOrphans stopped =>
        [
            .. stopped.Orphans.Select(orphan => Refusal("taxonomy-orphan",
                $"competition '{orphan.Path}' exists in the DB but not in metadata.shared.json — register it (or "
                + "remove the row) before importing"))
        ],

        // Every refusal an import that went through the draft found
        DraftImportFinished finished => From(finished.Findings, organization),

        // Unhandled cases
        _ => throw new ArgumentOutOfRangeException(nameof(outcome), outcome, "Unknown import outcome.")
    };

    /// <summary>
    /// Every refusal an import that went through the whole draft came back with, each as a blocking issue.
    /// </summary>
    /// <param name="findings"><inheritdoc cref="DraftImportFinished.Findings" path="/summary"/></param>
    /// <param name="organization">The organization slug the draft names, or null where it names none.</param>
    /// <returns>One issue per refusal, empty when the database takes the draft.</returns>
    private static List<VerdictError> From(DraftImportFindings findings, string? organization)
    {
        // The texts the import refuses, the routine outcomes left to the report.
        var issues = findings.TextResolutions
            .Select(IssueFor)
            .OfType<VerdictError>()
            .ToList();

        // A gap the import would leave in the round.
        if (!findings.MissingProblemOrders.IsEmpty)
            issues.Add(Refusal("round-contiguity",
                "importing would leave the round non-contiguous — problem(s) "
                + $"{findings.MissingProblemOrders.ToJoinedString()} missing from 1..N; every problem must already "
                + "exist or be imported so the round has no gaps"));

        // A round the site runs owes its group a fixed number of problems; short or long breaks the listing.
        if (findings.HostedGroupCountDisagreement is { } disagreement)
            issues.Add(Refusal("hosted-group-count",
                $"importing would leave the round holding {disagreement.RoundWouldHold} problem(s), but its hosted "
                + $"group announces {disagreement.GroupAnnounces} — fix the draft, or correct the group manifest"));

        // A round the site runs keeps the embargo its group stamped on it.
        if (findings.HostedEmbargoDisagreement is { } embargo)
            issues.Add(Refusal("hosted-embargo",
                $"the round runs in a hosted group and its stored visibleSince is {Describe(embargo.Stored)}, but the "
                + $"draft's is {Describe(embargo.Draft)} — make the draft's match the stored one"));

        // A draft for the proposals naming any other embargo, or none, would open the pool's round or move its lock.
        if (findings.MovesProposalsEmbargo)
            issues.Add(Refusal("proposals-embargo",
                $"a draft for {HostedTaxonomy.ProposalsPath} must carry visibleSince: "
                + $"{HostedTaxonomy.ProposalsVisibleSince.UtcDateTime:s}Z, the instant holding the pool back"));

        // A pool draft naming no organization or one that doesn't exist, or any other draft naming one.
        if (findings.OrganizationProblem is { } organizationProblem)
            issues.Add(Refusal("proposals-organization", OrganizationRefusal(organizationProblem, organization)));

        // One blocking issue per reason the pool refuses a draft problem.
        issues.AddRange(findings.ProposalConflicts.Select(RefusalFor));

        // Every refusal.
        return issues;
    }

    /// <summary>
    /// Turns one per-text resolution into an issue, or null when the outcome is routine. The blocking outcomes are a
    /// second original (a forbidden different-language original), a translation-only drop onto a missing problem, and
    /// a fresh problem with no metadata sidecar; adds, unchanged re-imports and intentional in-place overwrites are
    /// routine outcomes the report records without alarm.
    /// </summary>
    /// <param name="resolution">What the import does to one text.</param>
    /// <returns>The blocking issue, or null for a routine outcome.</returns>
    private static VerdictError? IssueFor(ProblemTextResolution resolution)
    {
        // The half, lower-cased to match the rest of the report.
        var half = resolution.DocumentType.ToString().ToLowerInvariant();
        var slug = resolution.Slug;

        // The create-conflict outcomes block; everything else is a routine outcome the report already records.
        return resolution.Action switch
        {
            DraftTextAction.SecondOriginal => Refusal("original-conflict",
                $"problem '{slug}' {half} already has an original in a different language — importing as original "
                + "would create a second original (forbidden)"),

            DraftTextAction.NoOriginalForNewProblem => Refusal("no-original-new-problem",
                $"problem '{slug}' has no original-language body and does not exist yet — a translation-only drop "
                + "requires the problem to already exist"),

            DraftTextAction.NewProblemMissingMetadata => Refusal("missing-problem-meta",
                $"problem '{slug}' would be created but carries no pN.yaml metadata file — a fresh problem must "
                + "declare its metadata (only a re-import onto an existing problem may omit it)"),

            // Adds, unchanged re-imports and intentional in-place overwrites are all expected — nothing to flag.
            DraftTextAction.AddOriginal or DraftTextAction.AddTranslation
                or DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation
                or DraftTextAction.OverwriteOriginal or DraftTextAction.OverwriteTranslation => null,

            // Unhandled cases.
            _ => throw new ArgumentOutOfRangeException(nameof(resolution), resolution.Action, null)
        };
    }

    /// <summary>
    /// Says what is wrong with the organization a draft names, and how to get past it.
    /// </summary>
    /// <param name="problem">What is wrong with the organization the draft names.</param>
    /// <param name="organization">The slug the draft names, or null where it names none.</param>
    /// <returns>The message of the issue blocking the import.</returns>
    private static string OrganizationRefusal(DraftOrganizationProblem problem, string? organization) => problem switch
    {
        DraftOrganizationProblem.Missing =>
            $"a draft for {HostedTaxonomy.ProposalsPath} must name the organization whose pool it fills, as "
            + "organization: <slug>",

        DraftOrganizationProblem.Unknown => $"no organization goes by '{organization}' — name one that exists",

        DraftOrganizationProblem.OutsidePool =>
            $"only a draft for {HostedTaxonomy.ProposalsPath} fills an organization's pool — drop the organization",

        _ => throw new ArgumentOutOfRangeException(nameof(problem), problem, "Unknown organization problem."),
    };

    /// <summary>
    /// Turns one reason the pool refuses a draft problem into the issue blocking the import.
    /// </summary>
    /// <param name="conflict">What the pool refuses about the problem.</param>
    /// <returns>The blocking issue.</returns>
    private static VerdictError RefusalFor(ProposalConflict conflict)
    {
        // The problem the refusal is about.
        var slug = conflict.Slug;

        // The rule and the message naming what is refused and how to get past it.
        var (rule, message) = conflict switch
        {
            ProposalOutsidePool => ("proposal-outside-pool",
                $"problem '{slug}' carries a proposal block, but only a draft for {HostedTaxonomy.ProposalsPath} "
                + "files problems in the pool — drop the block"),

            PoolProblemWithoutProposal => ("missing-proposal",
                $"problem '{slug}' would enter the pool with no proposal block read from its pN.yaml, so no "
                + "reviewer would ever see it — add the block, or fix the error that kept the pN.yaml from being "
                + "read"),

            ProposalNumberTaken taken => ("proposal-number-taken",
                $"problem '{slug}' names proposal #{taken.Number}, which problem '{taken.HolderSlug}' already holds "
                + "in the same pool — a proposal keeps its number for good, in a round or deleted"),

            PlaceHoldsAnotherPoolsProposal another => ("proposal-other-pool",
                $"problem '{slug}' is proposal #{another.Number} of {another.OrganizationSlug}'s pool, which a "
                + "draft for another organization may not rewrite — give the problem another place"),

            ProposalDeleted deleted => ("proposal-deleted",
                $"problem '{slug}' is proposal #{deleted.Number}, which the reviewers deleted — drop it from the "
                + "draft, or clear its deleted_at in the database to bring it back"),

            PlaceHoldsAnotherProposal another => ("proposal-place-taken",
                $"problem '{slug}' is proposal #{another.StoredNumber}, but the draft names #{another.DraftNumber} "
                + "for it — a pool problem keeps the place it first took"),

            PlaceHoldsNoProposal => ("proposal-place-unfiled",
                $"problem '{slug}' sits in the pool's round with no proposal filing it, so the draft can't be "
                + "matched to it — file it in the database first, or give the problem another place"),

            ProposalCategoryUnknown unknown => ("proposal-unknown-category",
                $"problem '{slug}' is recommended for '{unknown.Category}', which the pool's organization doesn't "
                + "list as a category — "
                // An organization listing no categories leaves nothing to name
                + (unknown.Listed.Count == 0
                    ? "it lists none, so leave recommended empty"
                    : $"name one of {string.Join(", ", unknown.Listed)}")),

            // Unhandled cases.
            _ => throw new ArgumentOutOfRangeException(nameof(conflict), conflict, "Unknown proposal conflict.")
        };

        // A blocking issue, attributed to the folder like everything else the database surfaces.
        return Refusal(rule, message);
    }

    /// <summary>
    /// A blocking issue the database raised, attributed to the folder's <c>_meta.yaml</c>.
    /// </summary>
    /// <param name="rule">The machine-readable issue category.</param>
    /// <param name="message">What is refused and how to get past it.</param>
    /// <returns>The error-severity issue.</returns>
    private static VerdictError Refusal(string rule, string message) =>
        new(ManifestMeta.FileName, Half: null, Line: null, Col: null, rule, message, VerdictSeverity.Error);

    /// <summary>
    /// Says an embargo instant the way a draft's <c>visibleSince</c> carries it, including the case of there not being
    /// one.
    /// </summary>
    /// <param name="instant">The instant, or null when there is none.</param>
    /// <returns>The instant in UTC to its full stored precision, or a word for its absence.</returns>
    private static string Describe(DateTimeOffset? instant) =>
        // An ISO instant in UTC, its fraction kept so the draft can copy it exactly, or none
        instant is { } value
            ? value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.FFFFFFF'Z'", CultureInfo.InvariantCulture)
            : "none";
}
