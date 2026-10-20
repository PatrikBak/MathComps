using MathComps.Cli.BulkImport.Manifest;
using MathComps.Cli.BulkImport.Validation;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Services.BulkImport;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests that the import's refusals and the errors the report prints for them agree. Whether the import keeps a
/// draft, and the verdict the report closes on, come from the outcome, while the report's error lines come from the
/// errors. So a refusal with no error prints a bare FAIL, and an error with no refusal prints an error over an
/// import that was kept.
/// </summary>
public class ImportIssuesTests
{
    /// <summary>
    /// Findings refusing nothing: the import takes the draft as it is.
    /// </summary>
    private static readonly DraftImportFindings _clean = new(
        Entities: [], TextResolutions: [], Problems: [], MissingProblemOrders: [], SortOrderChanges: [],
        HostedGroupCountDisagreement: null, HostedEmbargoDisagreement: null, MovesProposalsEmbargo: false,
        OrganizationProblem: null, ProposalConflicts: []);

    /// <summary>
    /// An import stopped at stored rows the registry can't place, and each refusal outside the texts set alone on
    /// otherwise clean findings, refuses the import and comes with an error, and the clean findings do neither.
    /// </summary>
    [Fact]
    public async Task Every_refusal_refuses_the_import_and_comes_with_an_error()
    {
        // One set of findings per refusal, each set alone.
        DraftImportFindings[] refusals =
        [
            _clean with { MissingProblemOrders = [3] },
            _clean with { HostedGroupCountDisagreement = new HostedGroupCountDisagreement(1, 2) },
            _clean with { HostedEmbargoDisagreement = new HostedEmbargoDisagreement(null, DateTimeOffset.UnixEpoch) },
            _clean with { MovesProposalsEmbargo = true },
            .. Enum.GetValues<DraftOrganizationProblem>()
                .Select(problem => _clean with { OrganizationProblem = problem }),
            _clean with { ProposalConflicts = [new ProposalOutsidePool("74-csmo-a-iii-1")] },
            _clean with { ProposalConflicts = [new PoolProblemWithoutProposal("76-mathcomps-proposals-8")] },
            _clean with { ProposalConflicts = [new ProposalNumberTaken("76-mathcomps-proposals-8", 14, "x")] },
            _clean with { ProposalConflicts = [new ProposalDeleted("76-mathcomps-proposals-8", 14)] },
            _clean with { ProposalConflicts = [new PlaceHoldsAnotherProposal("76-mathcomps-proposals-8", 14, 19)] },
            _clean with { ProposalConflicts = [new PlaceHoldsNoProposal("76-mathcomps-proposals-8")] },
            _clean with
            {
                ProposalConflicts = [new PlaceHoldsAnotherPoolsProposal("76-mathcomps-proposals-8", 14, "olympiad")]
            },
            _clean with { ProposalConflicts = [new ProposalCategoryUnknown("76-mathcomps-proposals-8", "C", [])] }
        ];

        // An import stopped at stored rows the registry can't place, then a dry run finding each refusal.
        DraftImportOutcome[] refused =
        [
            DraftImportStoppedAtOrphans.IfAny([new TaxonomyOrphan("notacomp")])!,
            .. await Task.WhenAll(refusals.Select(FinishedImports.DryRunAsync))
        ];

        // Each is refused, and an error says why.
        Assert.All(refused, outcome =>
        {
            Assert.True(outcome.IsRefused);
            Assert.Contains(
                ImportIssues.From(outcome, organization: null), issue => issue.Severity == VerdictSeverity.Error);
        });

        // A dry run finding nothing to refuse.
        var clean = await FinishedImports.DryRunAsync(_clean);

        // The clean dry run is not refused and raises no issue.
        Assert.False(clean.IsRefused);
        Assert.Empty(ImportIssues.From(clean, organization: null));
    }

    /// <summary>
    /// A text the import refuses comes with an error, and a text it writes or leaves comes with none, for every way
    /// the import can treat a text.
    /// </summary>
    [Fact]
    public async Task A_text_comes_with_an_error_exactly_when_the_import_refuses_it()
    {
        // One dry run per way of treating a text, each finding that one text.
        var outcomes = await Task.WhenAll(Enum.GetValues<DraftTextAction>().Select(action =>
            FinishedImports.DryRunAsync(_clean with
            {
                TextResolutions =
                    [new ProblemTextResolution("74-csmo-a-iii-1", DocumentType.Statement, Language.SK, action)]
            })));

        // The error and the refusal go together.
        Assert.All(outcomes, outcome => Assert.Equal(
            outcome.IsRefused,
            ImportIssues.From(outcome, organization: null).Any(issue => issue.Severity == VerdictSeverity.Error)));
    }
}
