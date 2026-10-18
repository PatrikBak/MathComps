using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Selection;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftResolutionService"/>. Spins up a short-lived, no-tracking
/// <see cref="MathCompsDbContext"/> per call and resolves each taxonomy entity with an <c>AnyAsync</c> existence
/// probe. It loads the problems already at the draft's slugs with their stored content, and the proposals filing
/// them, and reports for each the <see cref="ProblemReimport"/> plan the import would carry out. It also loads the
/// round's full set of problem orders to check that the import would leave a round outside the proposals contiguous,
/// and for a round of the proposals reads the proposals already holding the draft's numbers.
/// </summary>
/// <param name="dbContextFactory">Factory for creating read-only database contexts.</param>
/// <param name="metadata">The registry, source of the structural sort orders the preview reconciles against.</param>
public class DraftResolutionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService metadata) : IDraftResolutionService
{
    /// <inheritdoc/>
    public async Task<DraftDbPreview> PreviewAsync(
        DraftTarget target,
        DateTimeOffset? visibleSince,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder)
    {
        // Read-only context; nothing here writes.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Whether the competition path already addresses a stored competition.
        var competitionExists = await context.Competitions.AsNoTracking()
            .AnyAsync(competition => competition.Path == target.CompetitionPath);

        // Season resolves by start year
        var seasonExists = await context.Seasons.AsNoTracking()
            .AnyAsync(season => season.StartYear == target.SeasonYear);

        // Whether that competition already has a sitting in that season.
        var roundExists = await context.Rounds.AsNoTracking()
            .AnyAsync(round => round.Competition.Path == target.CompetitionPath
                               && round.Season.StartYear == target.SeasonYear);

        // Order matters for the preview: competition, then season, then round.
        var resolutions = ImmutableArray.Create(
            new EntityResolution("competition", target.CompetitionPath, ToAction(competitionExists)),
            new EntityResolution("season", target.SeasonYear.ToString(), ToAction(seasonExists)),
            new EntityResolution("round", $"{target.CompetitionPath} {target.SeasonYear}", ToAction(roundExists)));

        // Map each draft problem to its would-be slug so we can both probe the DB and report against it.
        var slugByOrder = problems.ToDictionary(problem => problem.Order, problem => target.ProblemSlug(problem.Order));

        // Load the problems already at the draft's slugs, with everything a re-import compares against, keyed by slug.
        var candidateSlugs = slugByOrder.Values.ToList();
        var existingBySlug = await ProblemReimport.IncludeStoredContent(context.Problems.AsNoTracking())
            .Where(problem => candidateSlugs.Contains(problem.Slug))
            .ToDictionaryAsync(problem => problem.Slug);

        // The proposals filing the problems already at the draft's places, keyed by the place's slug.
        var storedProposalBySlug = await context.Proposals.AsNoTracking()
            .Include(proposal => proposal.Problem)
            .Where(proposal => candidateSlugs.Contains(proposal.Problem.Slug))
            .ToDictionaryAsync(proposal => proposal.Problem.Slug);

        // What importing each problem does, to the problem as a whole and to each of its texts.
        var problemPreviews = problems
            .Select(problem =>
            {
                // The place the problem lands on.
                var slug = slugByOrder[problem.Order];

                // What importing does to whatever already sits there.
                return PreviewProblem(
                    slug, problem, existingBySlug.GetValueOrDefault(slug), storedProposalBySlug.GetValueOrDefault(slug),
                    draftFolder);
            })
            .ToList();

        // Every per-text outcome, in draft order.
        var textResolutions = problemPreviews.SelectMany(preview => preview.Texts).ToImmutableArray();

        // Every per-problem outcome, in draft order.
        var problemResolutions = problemPreviews.Select(preview => preview.Problem).ToImmutableArray();

        // Contiguity is a post-import property: once this import lands, the problem orders of a round outside the
        // proposals — those already in the DB plus the draft's — must run 1..N with no gap. Loading every order in
        // the round (not just the draft's candidate slugs) is what lets a fresh import that skipped a problem, or a
        // subset re-import onto a slug that doesn't exist yet, be told apart from a legitimate correction or append.
        var existingOrders = await context.Problems.AsNoTracking()
            .Where(problem => problem.Round.Competition.Path == target.CompetitionPath
                              && problem.Round.Season.StartYear == target.SeasonYear)
            .Select(problem => problem.Number)
            .ToListAsync();

        // The orders present after the import.
        var postImportOrders = existingOrders.Concat(problems.Select(problem => problem.Order)).ToHashSet();

        // The highest of them, zero for an empty round.
        var highestOrder = postImportOrders.Count == 0 ? 0 : postImportOrders.Max();

        // Whether the draft lands in the pool, a round of the proposals.
        var isProposalsRound = SelectionRules.IsInPool(target.CompetitionPath);

        // The gaps in 1..N the import would leave, which only a round outside the proposals reports.
        var missingProblemOrders = isProposalsRound
            // None for a round of the proposals, whose numbering may run with gaps.
            ? []
            // Anywhere else the numbers are what a reader quotes, so a gap is a problem missing.
            : Enumerable.Range(1, highestOrder)
                .Where(order => !postImportOrders.Contains(order))
                .ToImmutableArray();

        // The taxonomy rows apply would renumber to match the registry, plus any row the registry can't place.
        var (sortOrderChanges, orphans) = await PreviewSortOrderAsync(context, target.CompetitionPath);

        // The texts this import would rewrite on a problem someone has already defended.
        var defendedRestatements = await PreviewDefendedRestatementsAsync(context, textResolutions);

        // How the round's post-import count would sit against its group's promise, null whenever nothing is amiss.
        var countDisagreement = await PreviewHostedCountAsync(context, target, postImportOrders.Count);

        // Whether a draft for the proposals names any embargo but the pool's instant, none included.
        var movesProposalsEmbargo = isProposalsRound && visibleSince != HostedTaxonomy.ProposalsVisibleSince;

        // Every reason a draft problem can't be filed in the pool the way the draft says.
        var proposalConflicts = await PreviewProposalConflictsAsync(
            context, isProposalsRound, problems, slugByOrder, existingBySlug.Keys.ToHashSet(), storedProposalBySlug);

        // Hand back everything the preview found.
        return new DraftDbPreview(
            resolutions, textResolutions, problemResolutions, missingProblemOrders, sortOrderChanges, orphans,
            defendedRestatements, countDisagreement, movesProposalsEmbargo, proposalConflicts);
    }

    /// <summary>
    /// Finds every reason a draft problem can't be filed in the pool the way the draft says. Outside the proposals that
    /// is any problem carrying a <c>proposal:</c> block; inside them, see <see cref="ClassifyProposal"/>.
    /// </summary>
    /// <param name="context">The read-only context.</param>
    /// <param name="isProposalsRound">Whether the draft lands in a round of the proposals.</param>
    /// <param name="problems">The draft's problems.</param>
    /// <param name="slugByOrder">Each draft problem's would-be slug, keyed by its order.</param>
    /// <param name="takenSlugs">The would-be slugs a problem already holds.</param>
    /// <param name="storedBySlug">
    /// The proposals filing the problems already at the draft's places, with their problems, keyed by the place's slug.
    /// </param>
    /// <returns>One conflict per thing refused, empty when the draft files cleanly.</returns>
    private static async Task<ImmutableArray<ProposalConflict>> PreviewProposalConflictsAsync(
        MathCompsDbContext context,
        bool isProposalsRound,
        IReadOnlyList<DraftProblemContent> problems,
        IReadOnlyDictionary<int, string> slugByOrder,
        IReadOnlySet<string> takenSlugs,
        IReadOnlyDictionary<string, Proposal> storedBySlug)
    {
        // Outside the proposals nothing is filed, so a block there has nowhere to go.
        if (!isProposalsRound)
            return
            [
                .. problems
                    .Where(problem => problem.Proposal is not null)
                    .Select(problem => new ProposalOutsidePool(slugByOrder[problem.Order]))
            ];

        // The proposals holding the numbers the draft's blocks name, wherever their problems sit, keyed by number.
        var numbers = problems.Select(problem => problem.Proposal?.Number).OfType<int>().ToList();
        var holderByNumber = await context.Proposals.AsNoTracking()
            .Include(proposal => proposal.Problem)
            .Where(proposal => numbers.Contains(proposal.Number))
            .ToDictionaryAsync(proposal => proposal.Number);

        // Classify each draft problem against what its place and its number already hold.
        return
        [
            .. problems.SelectMany(problem =>
            {
                // The place the problem lands on.
                var slug = slugByOrder[problem.Order];

                // Its conflicts, if any.
                return ClassifyProposal(
                    slug, problem.Proposal, takenSlugs.Contains(slug), storedBySlug.GetValueOrDefault(slug),
                    holderByNumber);
            })
        ];
    }

    /// <summary>
    /// Finds the statement rewrites that would land on a problem students have already defended. A defense names its
    /// problem by id, and a re-import rewrites texts under the id the slug already holds, so a statement rewritten
    /// there files every defense of the id under a problem it may never have been about.
    /// </summary>
    /// <param name="context">The read-only context.</param>
    /// <param name="textResolutions">
    /// The per-text resolutions, whose overwrite outcomes name the texts that change.
    /// </param>
    /// <returns>
    /// One entry per changed statement on a defended problem; empty when nothing changes or nothing is defended.
    /// </returns>
    private static async Task<ImmutableArray<DefendedProblemRestatement>> PreviewDefendedRestatementsAsync(
        MathCompsDbContext context, ImmutableArray<ProblemTextResolution> textResolutions)
    {
        // The statements whose stored body would change; an add, an unchanged re-import and a create conflict all
        // leave the problem a defense was held about exactly where it is. A session keeps its own copy of the
        // statement and reference solution it was argued against, so a solution rewrite strands nothing.
        var rewrites = textResolutions
            .Where(resolution => resolution.Action
                is DraftTextAction.OverwriteOriginal or DraftTextAction.OverwriteTranslation)
            .Where(resolution => resolution.DocumentType == DocumentType.Statement)
            .ToList();

        // Nothing would be rewritten, so no defense can be stranded.
        if (rewrites.Count == 0)
            return [];

        // The problems those rewrites land on.
        var rewrittenSlugs = rewrites.Select(resolution => resolution.Slug).Distinct().ToList();

        // How many defenses each of them already carries, counting only the ones that have any.
        var defenseCountBySlug = await context.ProblemDefenses.AsNoTracking()
            .Where(defense => rewrittenSlugs.Contains(defense.Problem.Slug))
            .GroupBy(defense => defense.Problem.Slug)
            .Select(group => new { Slug = group.Key, Count = group.Count() })
            .ToDictionaryAsync(row => row.Slug, row => row.Count);

        // Pair each rewrite that lands on a defended problem with that problem's defense count.
        return
        [
            .. rewrites
                .Where(resolution => defenseCountBySlug.ContainsKey(resolution.Slug))
                .Select(resolution => new DefendedProblemRestatement(
                    resolution.Slug,
                    resolution.Language,
                    defenseCountBySlug[resolution.Slug]))
        ];
    }

    /// <summary>
    /// Reads how many problems the round's group announces and compares it against the count the round would hold
    /// once this import lands. See <see cref="HostedGroupCountDisagreement"/> for what a mismatch costs.
    /// </summary>
    /// <param name="context">The read-only context.</param>
    /// <param name="target">The taxonomy the draft lands in, naming the round.</param>
    /// <param name="postImportCount">How many problems the round would hold once this import lands.</param>
    /// <returns>The disagreement, or null when the counts agree or no group runs the round.</returns>
    private static async Task<HostedGroupCountDisagreement?> PreviewHostedCountAsync(
        MathCompsDbContext context, DraftTarget target, int postImportCount)
    {
        // What the round's group announces, null both when the round runs in no group and when it isn't there yet.
        var announced = await context.Rounds.AsNoTracking()
            .Where(round => round.Competition.Path == target.CompetitionPath
                            && round.Season.StartYear == target.SeasonYear)
            .Select(round => (int?)round.HostedGroup!.ProblemCount)
            .FirstOrDefaultAsync();

        // Nothing announced anything, so the round's count answers to nobody.
        if (announced is not { } groupAnnounces)
            return null;

        // Report the mismatch, or nothing when the import lands the paper the group promised.
        return postImportCount == groupAnnounces
            ? null
            : new HostedGroupCountDisagreement(postImportCount, groupAnnounces);
    }

    /// <summary>
    /// Previews the sort-order reconciliation apply would perform: which stored competition nodes the registry would
    /// renumber, and which carry a path the registry no longer knows. Read-only, and scoped to exactly the
    /// generations apply descends through — those are the ones whose renumbering a stray row could collide with.
    /// </summary>
    /// <param name="context">The read-only context.</param>
    /// <param name="competitionPath">The path the draft names its competition by, whose chain is the scope.</param>
    /// <returns>The renumbering apply would perform, and the unregistered (orphan) rows blocking it.</returns>
    private async Task<(ImmutableArray<SortOrderChange> Changes, ImmutableArray<TaxonomyOrphan> Orphans)>
        PreviewSortOrderAsync(MathCompsDbContext context, string competitionPath)
    {
        // Accumulate across the generations the walk would touch.
        var changes = ImmutableArray.CreateBuilder<SortOrderChange>();
        var orphans = ImmutableArray.CreateBuilder<TaxonomyOrphan>();

        // Each generation the path runs through, named by the parent whose children it is — the roots first,
        // then every node above the target. Descending the same way apply does is what keeps the two in step.
        foreach (var (parentPath, _, _) in CompetitionTree.Descend(competitionPath))
        {
            // The nodes already sitting in it. A root has no parent path to match on.
            var siblings = await context.Competitions.AsNoTracking()
                .Where(node => parentPath == null ? node.ParentId == null : node.Parent!.Path == parentPath)
                .Select(node => new { node.Path, node.SortOrder }).ToListAsync();

            // Where the registry puts each of them, null for one it can't place.
            var registryOrderOf = TaxonomyResequencer.ChildOrder(metadata.Shared, parentPath);

            // The renumbering this generation needs, and the rows that block it.
            changes.AddRange(TaxonomyResequencer.ComputeChanges(
                [.. siblings.Select(row => (row.Path, row.SortOrder))], registryOrderOf));
            orphans.AddRange(siblings
                .Where(row => registryOrderOf(row.Path) is null)
                .Select(row => new TaxonomyOrphan(row.Path)));
        }

        // The reconciliation preview.
        return (changes.ToImmutable(), orphans.ToImmutable());
    }

    /// <summary>
    /// Decides what keeps one problem of a draft for the proposals out of the pool. A problem new to the pool enters
    /// it only through its block. A taken place keeps the problem already there, which has to be a live proposal under
    /// the block's number. And no other problem's proposal may hold the block's number.
    /// </summary>
    /// <param name="slug">The would-be problem slug, naming its place.</param>
    /// <param name="proposal">The draft's block, or null when it carries none.</param>
    /// <param name="isPlaceTaken">Whether a problem already holds the place.</param>
    /// <param name="stored">The proposal filing the problem at the place, or null when none does.</param>
    /// <param name="holderByNumber">
    /// The proposals holding the numbers the draft names, with their problems, keyed by number.
    /// </param>
    /// <returns>The problem's conflicts, empty when it files cleanly.</returns>
    private static IEnumerable<ProposalConflict> ClassifyProposal(
        string slug,
        DraftProposal? proposal,
        bool isPlaceTaken,
        Proposal? stored,
        IReadOnlyDictionary<int, Proposal> holderByNumber)
    {
        // A new problem on a free place, with no block to file it in the pool.
        if (!isPlaceTaken && proposal is null)
            yield return new PoolProblemWithoutProposal(slug);

        // A taken place whose problem no proposal files.
        if (isPlaceTaken && stored is null)
            yield return new PlaceHoldsNoProposal(slug);

        // A taken place whose proposal the reviewers deleted.
        if (stored is { DeletedAt: not null })
            yield return new ProposalDeleted(slug, stored.Number);

        // A taken place whose live proposal goes by another number than the block's.
        if (stored is { DeletedAt: null } && proposal is not null && proposal.Number != stored.Number)
            yield return new PlaceHoldsAnotherProposal(slug, stored.Number, proposal.Number);

        // Another problem's proposal holding the block's number.
        if (proposal is not null
            && holderByNumber.TryGetValue(proposal.Number, out var holder)
            && holder.Problem.Slug != slug)
            yield return new ProposalNumberTaken(slug, proposal.Number, holder.Problem.Slug);
    }

    /// <summary>
    /// Previews one draft problem. A slug the database lacks is a create, carrying the reason the import would refuse
    /// it, if any. An existing problem takes the plan a re-import carries out, and is updated when the plan changes
    /// anything.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="existing">
    /// The problem already at the slug, with its stored content, or null when it is absent.
    /// </param>
    /// <param name="storedProposal">The proposal filing the problem at the slug, or null when none does.</param>
    /// <param name="draftFolder">The draft folder the image refs resolve against.</param>
    /// <returns>The problem's outcome and the outcome of each of its texts.</returns>
    private static ProblemPreview PreviewProblem(
        string slug, DraftProblemContent problem, Problem? existing, Proposal? storedProposal, string draftFolder)
    {
        // The languages the draft writes the problem in.
        var languages = problem.Texts.Select(text => text.Language).ToImmutableArray();

        // A slug the database lacks is a problem the import creates.
        if (existing is null)
            return new ProblemPreview(
                new ProblemResolution(slug, ResolutionAction.Create, languages), CreateConflictOf(slug, problem));

        // What re-importing the draft onto the stored problem does, its bodies sized off the draft's figures.
        var plan = ProblemReimport.Plan(
            problem, existing, storedProposal, ProblemImageRefs.BuildReplacements(problem.Images, slug, draftFolder));

        // Updated when the plan changes anything, left as it is otherwise.
        var action = plan.ChangesAnything ? ResolutionAction.Update : ResolutionAction.Reuse;

        // The problem's outcome beside each half the plan writes.
        return new ProblemPreview(
            new ProblemResolution(slug, action, languages),
            [.. plan.Halves.Select(half => new ProblemTextResolution(
                slug, half.DocumentType, half.Text.Language, half.Action))]);
    }

    /// <summary>
    /// The reason the import would refuse to create a problem, flagged once against its first text. A problem with no
    /// text at all gets none, since the preflight already reports its empty group.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <returns>The refusal, or nothing when the create is clean.</returns>
    private static ImmutableArray<ProblemTextResolution> CreateConflictOf(string slug, DraftProblemContent problem) =>
        // A first text to pin the refusal on, and a refusal to pin
        problem is { Texts: [var firstText, ..], CreateConflict: { } conflict }
            ? [new ProblemTextResolution(slug, DocumentType.Statement, firstText.Language, conflict)]
            : [];

    /// <summary>
    /// Maps an existence flag to its resolution action.
    /// </summary>
    /// <param name="exists">Whether the entity was found in the DB.</param>
    /// <returns>
    /// <see cref="ResolutionAction.Reuse"/> when present, <see cref="ResolutionAction.Create"/> when not.
    /// </returns>
    private static ResolutionAction ToAction(bool exists) =>
        exists ? ResolutionAction.Reuse : ResolutionAction.Create;

    /// <summary>
    /// What importing one draft problem does: to the problem as a whole, and to each of its texts.
    /// </summary>
    /// <param name="Problem">The problem's outcome.</param>
    /// <param name="Texts">
    /// The outcome of each text of an existing problem. For a new one, the reason its create is refused, or nothing.
    /// </param>
    private record ProblemPreview(ProblemResolution Problem, ImmutableArray<ProblemTextResolution> Texts);
}
