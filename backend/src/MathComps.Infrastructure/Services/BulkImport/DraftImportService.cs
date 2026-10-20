using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using MathComps.Shared.Extensions;
using MathComps.Domain.Tagging;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftImportService"/>. Runs the whole import on one tracking
/// <see cref="MathCompsDbContext"/> inside one transaction: raises the competition node and season the draft's path
/// names through the <see cref="ICompetitionTreeWriter"/>, inserts the new problems with the proposals filing them,
/// and carries out the <see cref="ProblemReimport"/> plan on the existing ones. A refused run and a dry run end
/// before the commit, so the transaction rolls everything back; a clean real run uploads the figures through the
/// <see cref="ITrackedFileUploader"/> (which skips ones already on remote storage) and only then commits.
/// </summary>
/// <param name="dbContextFactory">Factory for the tracking write context.</param>
/// <param name="tree">Raises the competition node and the season the draft names.</param>
/// <param name="uploader">
/// Remote storage for the problem images, skipping ones unchanged since their last upload. Built only once a real
/// import is about to land, so a dry run needs no storage settings and leaves the upload ledger alone.
/// </param>
/// <param name="metadata">The metadata holding the taxonomy registry.</param>
public class DraftImportService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    ICompetitionTreeWriter tree,
    Lazy<ITrackedFileUploader> uploader,
    IMetadataLocalizationService metadata) : IDraftImportService
{
    /// <inheritdoc/>
    public async Task<DraftImportOutcome> ImportAsync(
        DraftTarget target,
        DateOnly date,
        DateTimeOffset? visibleSince,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder,
        bool dryRun)
    {
        // One tracking context for the whole run.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // One transaction for the whole run: raising a node saves each generation before descending into the next,
        // and every wholesale row replacement flushes as well, so the writes below land as they go. Nothing is kept
        // until the very end, which a refused run and a dry run never reach.
        await using var transaction = await context.Database.BeginTransactionAsync();

        // The stored nodes the registry can't place, in every generation the draft's path runs through.
        var orphans = await FindOrphansAsync(context, target.CompetitionPath);

        // Stop at any of them, since one stalls renumbering its generation and nothing below it can be raised.
        if (DraftImportStoppedAtOrphans.IfAny(orphans) is { } stopped)
            return stopped;

        // What the import does to the taxonomy.
        var entities = ImmutableArray.CreateBuilder<EntityResolution>();

        // Raise every node on the competition's path, renumbering each generation to the registry on the way down. The
        // renumbering runs before anything is created, so a mid-list insertion frees the slot the newcomer claims.
        var (competition, chain, sortOrderChanges) = await tree.ResolveNodeAsync(context, target.CompetitionPath);
        entities.AddRange(chain);

        // Season by start year.
        var (season, seasonAction) = await tree.GetOrCreateSeasonAsync(context, target.SeasonYear);
        entities.Add(new EntityResolution("season", target.SeasonYear.ToString(), seasonAction));

        // The round, this competition's sitting in this season, carrying the draft's date and visibility unless its
        // group holds another embargo.
        var (round, roundAction, embargoDisagreement) = await GetOrCreateRoundAsync(
            context, competition.Id, season.Id, date, visibleSince);
        entities.Add(new EntityResolution("round", $"{target.CompetitionPath} {target.SeasonYear}", roundAction));

        // Each draft problem's slug, the place it lands on, keyed by its order.
        var slugByOrder = problems.ToDictionary(problem => problem.Order, problem => target.ProblemSlug(problem.Order));

        // Every place the draft lands on.
        var candidateSlugs = slugByOrder.Values.ToList();

        // The problems already at the draft's places, with everything a re-import compares against, keyed by slug.
        var existingBySlug = await ProblemReimport.IncludeStoredContent(context.Problems)
            .Where(problem => candidateSlugs.Contains(problem.Slug))
            .ToDictionaryAsync(problem => problem.Slug);

        // The proposals filing the problems already at the draft's places, with their recommendations and
        // organizations, keyed by the place's slug.
        var storedProposalBySlug = await ProblemReimport.IncludeStoredRecommendations(context.Proposals)
            .Include(proposal => proposal.Problem)
            .Include(proposal => proposal.Organization)
            .Where(proposal => candidateSlugs.Contains(proposal.Problem.Slug))
            .ToDictionaryAsync(proposal => proposal.Problem.Slug);

        // Whether the draft lands in the pool, in a round of the proposals.
        var isProposalsRound = SelectionRules.IsInPool(target.CompetitionPath);

        // The organization whose pool the draft files its problems in, where it names one that exists.
        var organizationId = await context.Organizations.AsNoTracking()
            .Where(organization => organization.Slug == target.OrganizationSlug)
            .Select(organization => (Guid?)organization.Id)
            .FirstOrDefaultAsync();

        // Every reason a draft problem can't be filed in the pool the way the draft says.
        var proposalConflicts = await FindProposalConflictsAsync(
            context, isProposalsRound, organizationId, problems, slugByOrder, existingBySlug.Keys.ToHashSet(),
            storedProposalBySlug);

        // The places whose filing the pool refuses, which keep whatever filing they have.
        var refusedFilings = proposalConflicts.Select(conflict => conflict.Slug).ToHashSet();

        // What the import does to each problem, and to each text of one already there or of a create it refuses.
        var problemResolutions = ImmutableArray.CreateBuilder<ProblemResolution>();
        var textResolutions = ImmutableArray.CreateBuilder<ProblemTextResolution>();

        // Run-scoped caches, so an author or a tag shared across problems is looked up once.
        var authorsCache = new Dictionary<string, Author>();
        var tagsCache = new Dictionary<string, Tag>();

        // Each problem in turn.
        foreach (var problem in problems)
        {
            // The place the problem lands on.
            var slug = slugByOrder[problem.Order];

            // Each figure's relative ref mapped to its media ref, carrying the figure's intrinsic dimensions.
            var replacements = ProblemImageRefs.BuildReplacements(problem.Images, slug, draftFolder);

            // The organization whose pool takes the draft's filing of the problem, null when no pool does.
            var filingOrganizationId = refusedFilings.Contains(slug) ? null : organizationId;

            // The languages the draft writes the problem in.
            var languages = problem.Texts.Select(text => text.Language).ToImmutableArray();

            // A slug the database lacks is a problem the import creates, unless it refuses to.
            if (!existingBySlug.TryGetValue(slug, out var existing))
            {
                // The problem as a whole is a create.
                problemResolutions.Add(new ProblemResolution(slug, ResolutionAction.Create, languages));

                // A create the import refuses, pinned on the problem's first text, and nothing written for it.
                if (CreateConflictOf(slug, problem) is { } refusal)
                    textResolutions.Add(refusal);

                // Otherwise insert the new problem with its texts, authors, tags and filing.
                else
                    await InsertProblemAsync(
                        context, problem, slug, round.Id, replacements, filingOrganizationId, authorsCache,
                        tagsCache);
            }
            // Otherwise re-import the draft onto the problem already there.
            else
            {
                // The proposal filing the problem, or null when none does.
                var storedProposal = storedProposalBySlug.GetValueOrDefault(slug);

                // What re-importing the draft onto the problem does.
                var plan = ProblemReimport.Plan(problem, existing, storedProposal, replacements);

                // The problem as a whole: updated when the plan changes anything, left as it is otherwise.
                problemResolutions.Add(new ProblemResolution(
                    slug, plan.ChangesAnything ? ResolutionAction.Update : ResolutionAction.Reuse, languages));

                // Each half the plan writes, with what writing it does.
                textResolutions.AddRange(plan.Halves.Select(half =>
                    new ProblemTextResolution(slug, half.DocumentType, half.Text.Language, half.Action)));

                // Carry the plan out.
                await UpdateProblemAsync(
                    context, existing, problem, plan, storedProposal, filingOrganizationId, authorsCache, tagsCache);
            }
        }

        // The gaps the import would leave in the round, and how its count would sit against its group's promise.
        var (missingProblemOrders, countDisagreement) =
            await CheckRoundAfterImportAsync(context, round, problems, isProposalsRound);

        // Whether a draft for the proposals names an embargo other than the pool's instant, or none.
        var movesProposalsEmbargo = isProposalsRound && visibleSince != HostedTaxonomy.ProposalsVisibleSince;

        // What is wrong with the organization the draft names, if anything.
        var organizationProblem = OrganizationProblemOf(isProposalsRound, target.OrganizationSlug, organizationId);

        // Everything the run found.
        var findings = new DraftImportFindings(
            entities.ToImmutable(), textResolutions.ToImmutable(), problemResolutions.ToImmutable(),
            missingProblemOrders, sortOrderChanges, countDisagreement, embargoDisagreement, movesProposalsEmbargo,
            organizationProblem, proposalConflicts);

        // Every figure the draft carries, as its local file and the key it uploads under: its content id under the
        // problems/ prefix the resolver serves.
        var figures = problems
            .SelectMany(problem => problem.Images.Select(basename => (
                LocalPath: Path.Combine(draftFolder, "images", basename),
                Key: $"problems/{ProblemImageRefs.ContentId(slugByOrder[problem.Order], basename)}")))
            .ToList();

        // Flush and land the import as far as its findings and the dry run let it go. Whatever doesn't land rolls back
        // with the transaction.
        return await DraftImportFinished.SettleAsync(findings, dryRun, () => context.SaveChangesAsync(), async () =>
        {
            // Push the figures, now that the import is about to land.
            var uploads = await UploadFiguresAsync(figures);

            // Keep everything.
            await transaction.CommitAsync();

            // The figures the import pushed.
            return uploads;
        });
    }

    /// <summary>
    /// Finds the stored competition nodes the registry can't place, in every generation the draft's path descends
    /// through: the generations whose renumbering an unplaceable row could collide with.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="competitionPath">The path the draft names its competition by, whose chain is the scope.</param>
    /// <returns>The unregistered rows, empty in the normal case.</returns>
    private async Task<ImmutableArray<TaxonomyOrphan>> FindOrphansAsync(
        MathCompsDbContext context, string competitionPath)
    {
        // The unplaceable rows, across every generation the walk touches.
        var orphans = ImmutableArray.CreateBuilder<TaxonomyOrphan>();

        // Each generation the path runs through, named by the parent whose children it is: the roots first, then
        // every node above the target. Descending the same way the tree writer does keeps the two in step.
        foreach (var (parentPath, _, _) in CompetitionTree.Descend(competitionPath))
        {
            // The paths already sitting in it. A root has no parent path to match on.
            var siblingPaths = await context.Competitions.AsNoTracking()
                .Where(node => parentPath == null ? node.ParentId == null : node.Parent!.Path == parentPath)
                .Select(node => node.Path)
                .ToListAsync();

            // A function giving where the registry puts a sibling, null for one it can't place.
            var registryOrderOf = TaxonomyResequencer.ChildOrder(metadata.Shared, parentPath);

            // Collect the siblings the registry can't place.
            orphans.AddRange(siblingPaths
                .Where(path => registryOrderOf(path) is null)
                .Select(path => new TaxonomyOrphan(path)));
        }

        // Every unplaceable row on the way down.
        return orphans.ToImmutable();
    }

    /// <summary>
    /// Get-or-creates the round by (competition node, season), stamping the draft's date and visibility on a fresh
    /// row and refreshing a stale one: an existing round differing from the draft in either is updated in place so
    /// a corrected <c>_meta</c> actually lands, matching how the authors/tags reconcilers bring stored rows into
    /// line. Both fields are written from the draft, so dropping an embargo from <c>_meta</c> lifts the stored one,
    /// on every round but one the site runs itself: there the group's declaration owns the instant, so a draft naming
    /// another is refused and the round left as it is.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="competitionId">The id of the competition node whose problems these are.</param>
    /// <param name="seasonId">The season's id.</param>
    /// <param name="date">The round date from <c>_meta</c>.</param>
    /// <param name="visibleSince">The embargo instant from <c>_meta</c>, null when it names none.</param>
    /// <returns>What raising the round did.</returns>
    private static async Task<RoundResolution> GetOrCreateRoundAsync(
        MathCompsDbContext context, Guid competitionId, Guid seasonId, DateOnly date, DateTimeOffset? visibleSince)
    {
        // The existing round for this (competition node, season), or null when net-new.
        var existing = await context.Rounds.FirstOrDefaultAsync(
            round => round.CompetitionId == competitionId && round.SeasonId == seasonId);

        // Found it: reuse it when it already matches the draft, leave it where its group holds another embargo, and
        // otherwise refresh the stale fields in place.
        if (existing is not null)
        {
            // Already carries both of the draft's values — reuse it untouched.
            if (existing.Date == date && existing.VisibleSince == visibleSince)
                return new(existing, ResolutionAction.Reuse, EmbargoDisagreement: null);

            // A round the site runs is held back by its group's closing instant, so writing the draft's over it
            // would open a live competition's problems to everybody who can sign in, spending no entry. Leave it and
            // report the disagreement.
            if (existing.HostedGroupId is not null && existing.VisibleSince != visibleSince)
                return new(existing, ResolutionAction.Reuse,
                    new HostedEmbargoDisagreement(existing.VisibleSince, visibleSince));

            // One of them is stale: overwrite both in place.
            existing.Date = date;
            existing.VisibleSince = visibleSince;

            // Report the round as updated.
            return new(existing, ResolutionAction.Update, EmbargoDisagreement: null);
        }

        // Otherwise create it with the draft's date and visibility.
        var created = new Round
        {
            CompetitionId = competitionId,
            SeasonId = seasonId,
            Date = date,
            VisibleSince = visibleSince
        };
        await context.Rounds.AddAsync(created);

        // Report the round as created.
        return new(created, ResolutionAction.Create, EmbargoDisagreement: null);
    }

    /// <summary>
    /// Weighs the round as it would stand once the import lands: the gaps its numbering would leave, and how its
    /// problem count would sit against its group's promise.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="round">The round the draft's problems land in.</param>
    /// <param name="problems">The draft's problems.</param>
    /// <param name="isProposalsRound">Whether the round is one of the proposals, which may run with gaps.</param>
    /// <returns>The round as it would stand.</returns>
    private static async Task<RoundAfterImport> CheckRoundAfterImportAsync(
        MathCompsDbContext context, Round round, IReadOnlyList<DraftProblemContent> problems, bool isProposalsRound)
    {
        // The orders the round holds.
        var storedOrders = await context.Problems
            .Where(problem => problem.RoundId == round.Id)
            .Select(problem => problem.Number)
            .ToListAsync();

        // The orders it holds once this import lands: its stored ones plus the draft's, counted once each.
        var postImportOrders = storedOrders.Concat(problems.Select(problem => problem.Order)).ToHashSet();

        // The gaps in 1..N the import would leave. A round of the proposals may run with gaps; anywhere else the
        // numbers are what a reader quotes, so a gap is a problem missing.
        var missingOrders = isProposalsRound ? [] : postImportOrders.MissingFromOneToMax();

        // The gaps, with how the round's count would sit against its group's promise.
        return new(missingOrders, await HostedCountDisagreementAsync(context, round, postImportOrders.Count));
    }

    /// <summary>
    /// Reads how many problems the round's group announces and compares it against the count the round would hold
    /// once this import lands. See <see cref="HostedGroupCountDisagreement"/> for what a mismatch costs.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="round">The round the draft's problems land in.</param>
    /// <param name="postImportCount">How many problems the round would hold once this import lands.</param>
    /// <returns>The disagreement, or null when the counts agree or no group runs the round.</returns>
    private static async Task<HostedGroupCountDisagreement?> HostedCountDisagreementAsync(
        MathCompsDbContext context, Round round, int postImportCount)
    {
        // A round no group runs answers to nobody for how many problems it holds — a fresh one included, since a
        // group only ever takes a round over by declaration.
        if (round.HostedGroupId is not { } groupId)
            return null;

        // The number that group announces.
        var announced = await context.HostedGroups
            .Where(group => group.Id == groupId)
            .Select(group => group.ProblemCount)
            .SingleAsync();

        // Report the mismatch, or nothing when the import lands the paper the group promised.
        return postImportCount == announced ? null : new HostedGroupCountDisagreement(postImportCount, announced);
    }

    /// <summary>
    /// Finds every reason a draft problem can't be filed in the pool the way the draft says. Outside the proposals that
    /// is any problem carrying a <c>proposal:</c> block; inside them, see <see cref="ClassifyProposal"/>.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="isProposalsRound">Whether the draft lands in a round of the proposals.</param>
    /// <param name="organizationId">
    /// The organization whose pool the draft files its problems in, or null where it names none that exists.
    /// </param>
    /// <param name="problems">The draft's problems.</param>
    /// <param name="slugByOrder">Each draft problem's would-be slug, keyed by its order.</param>
    /// <param name="takenSlugs">The would-be slugs a problem already holds.</param>
    /// <param name="storedBySlug">
    /// The proposals filing the problems already at the draft's places, with their problems and organizations, keyed by
    /// the place's slug.
    /// </param>
    /// <returns>One conflict per thing refused, empty when the draft files cleanly.</returns>
    private static async Task<ImmutableArray<ProposalConflict>> FindProposalConflictsAsync(
        MathCompsDbContext context,
        bool isProposalsRound,
        Guid? organizationId,
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

        // The numbers the draft's blocks name.
        var numbers = problems.Select(problem => problem.Proposal?.Number).OfType<int>().ToList();

        // The proposals in the pool of the draft's organization holding the numbers the draft's blocks name, wherever
        // their problems sit, keyed by number.
        var holderByNumber = await context.Proposals.AsNoTracking()
            .Include(proposal => proposal.Problem)
            .Where(proposal => proposal.OrganizationId == organizationId && numbers.Contains(proposal.Number))
            .ToDictionaryAsync(proposal => proposal.Number);

        // The names of the categories of the organization whose pool the draft fills, in the order they run.
        var categoryNames = await context.OrganizationCategories.AsNoTracking()
            .Where(category => category.OrganizationId == organizationId)
            .OrderBy(category => category.Position)
            .Select(category => category.Name)
            .ToListAsync();

        // Classify each draft problem against what its place and its number already hold.
        return
        [
            .. problems.SelectMany(problem =>
            {
                // The place the problem lands on.
                var slug = slugByOrder[problem.Order];

                // The problem's conflicts, if any.
                return ClassifyProposal(
                    slug, problem.Proposal, organizationId, takenSlugs.Contains(slug),
                    storedBySlug.GetValueOrDefault(slug), holderByNumber, categoryNames);
            })
        ];
    }

    /// <summary>
    /// Inserts a brand-new problem with its texts, authors and tags, and the proposal filing it when the draft carries
    /// a block the pool takes.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="slug">The problem slug.</param>
    /// <param name="roundId">The round the problem hangs off.</param>
    /// <param name="replacements">The image-ref replacements to apply to each body.</param>
    /// <param name="filingOrganizationId">
    /// The organization whose pool takes the draft's filing of the problem, or null when no pool does.
    /// </param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="tagsCache">The run-scoped tag cache.</param>
    private static async Task InsertProblemAsync(
        MathCompsDbContext context,
        DraftProblemContent problem,
        string slug,
        Guid roundId,
        IReadOnlyDictionary<string, ResolvedImageRef> replacements,
        Guid? filingOrganizationId,
        IDictionary<string, Author> authorsCache,
        IDictionary<string, Tag> tagsCache)
    {
        // The new problem row.
        var newProblem = new Problem
        {
            Number = problem.Order,
            RoundId = roundId,
            Slug = slug,
            SolutionLink = problem.SolutionLink
        };
        await context.Problems.AddAsync(newProblem);

        // Each language variant in turn.
        foreach (var text in problem.Texts)
        {
            // Add every half the variant writes: the statement, plus a solution and hints when the draft carries them.
            foreach (var (documentType, markdown) in text.HalvesToWrite(replacements))
                AddText(context, newProblem.Id, documentType, text, markdown);
        }

        // Assign the draft's authors when it declares any — a brand-new problem has none to clear, so null and the
        // empty list both add nothing.
        if (problem.Authors is { } authorNames)
        {
            // Resolve the draft's authors to entities, in declared order.
            var authors = await ResolveAuthorsAsync(context, authorNames, authorsCache);

            // One ProblemAuthor per author, the ordinal 1-based in that order.
            for (var index = 0; index < authors.Count; index++)
                await context.ProblemAuthors.AddAsync(new ProblemAuthor
                {
                    ProblemId = newProblem.Id,
                    AuthorId = authors[index].Id,
                    Ordinal = index + 1
                });
        }

        // Assign the draft's tags when it declares any — a brand-new problem has none to clear, so null and the empty
        // list both add nothing.
        if (problem.Tags is { } tagSlugs)
            foreach (var tag in await ResolveTagsAsync(context, TagVocabulary.DistinctCanonical(tagSlugs), tagsCache))
                await context.ProblemTags.AddAsync(ProblemTag.HumanAssigned(newProblem.Id, tag.Id));

        // File the problem in the pool when the draft says how and an organization's pool takes it.
        if (problem.Proposal is { } proposal && filingOrganizationId is { } organizationId)
        {
            // The proposal.
            await context.Proposals.AddAsync(new Proposal
            {
                ProblemId = newProblem.Id,
                OrganizationId = organizationId,
                Number = proposal.Number,
                Title = proposal.Title,
                Area = proposal.Area,
            });

            // Recommended for the draft's categories.
            foreach (var categoryId in await ResolveCategoriesAsync(context, organizationId, proposal))
                await context.ProposalRecommendations.AddAsync(
                    new ProposalRecommendation { ProposalId = newProblem.Id, CategoryId = categoryId });
        }
    }

    /// <summary>
    /// Carries out the re-import of a draft problem onto the existing one, as its <see cref="ProblemReimport"/> plan
    /// says: writes each half, and takes the draft's solution link, authors, tags and proposal filing wherever they
    /// differ from the stored ones.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its stored content loaded.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="plan">What re-importing the draft onto the problem does.</param>
    /// <param name="storedProposal">
    /// The proposal filing the problem, with its recommendations, or null when none does.
    /// </param>
    /// <param name="filingOrganizationId">
    /// The organization whose pool takes the draft's filing of the problem, or null when no pool does.
    /// </param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="tagsCache">The run-scoped tag cache.</param>
    private static async Task UpdateProblemAsync(
        MathCompsDbContext context,
        Problem existing,
        DraftProblemContent problem,
        ProblemReimport plan,
        Proposal? storedProposal,
        Guid? filingOrganizationId,
        IDictionary<string, Author> authorsCache,
        IDictionary<string, Tag> tagsCache)
    {
        // Take the draft's solution link where it differs.
        if (plan.ChangesSolutionLink)
            existing.SolutionLink = problem.SolutionLink;

        // Write each half the draft carries.
        foreach (var half in plan.Halves)
            WriteHalf(context, existing, half);

        // Credit the draft's authors where they differ.
        if (plan.ChangesAuthors && problem.Authors is { } authorNames)
            await ReplaceAuthorsAsync(context, existing, authorNames, authorsCache);

        // Tag the problem with the draft's tags where they differ.
        if (plan.ChangesTags && problem.Tags is { } tagSlugs)
            await ReplaceTagsAsync(context, existing, tagSlugs, tagsCache);

        // File the problem the way the draft's block does, where the stored proposal files it differently and an
        // organization's pool takes the block. A place a pool takes a block onto always holds a proposal of that
        // organization, since any other is refused. The number is fixed, and the set-aside mark and the deletion
        // belong to the reviewers once the problem is in the pool.
        if (plan.ChangesProposal
            && filingOrganizationId is { } organizationId
            && problem.Proposal is { } proposal
            && storedProposal is not null)
        {
            // Take the draft's title and area.
            storedProposal.Title = proposal.Title;
            storedProposal.Area = proposal.Area;

            // The draft's categories, among those of the proposal's organization.
            var categoryIds = await ResolveCategoriesAsync(context, organizationId, proposal);

            // Take the draft's categories in place of the stored recommendations.
            await context.ReplaceRowsAsync(
                storedProposal.Recommendations,
                categoryIds.Select(categoryId =>
                    new ProposalRecommendation { ProposalId = storedProposal.ProblemId, CategoryId = categoryId }));
        }
    }

    /// <summary>
    /// Writes one half of a re-import the way its plan says: adds the text, rewrites the stored one in place, or leaves
    /// it. A second original is refused, so it is left too, and the run that planned it keeps nothing.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its texts loaded.</param>
    /// <param name="half">The planned half.</param>
    private static void WriteHalf(MathCompsDbContext context, Problem existing, ReimportedHalf half)
    {
        // What the plan says writing the half does.
        switch (half)
        {
            // A text the half lacks in this language: add it.
            case { Action: DraftTextAction.AddOriginal or DraftTextAction.AddTranslation }:
                AddText(context, existing.Id, half.DocumentType, half.Text, half.Markdown);
                break;

            // The stored text in this language with another body: rewrite it in place.
            case
            {
                Action: DraftTextAction.OverwriteOriginal or DraftTextAction.OverwriteTranslation,
                SameLanguageText: { } stored
            }:
                // The new body, stamped with when it changed.
                stored.MarkdownText = half.Markdown;
                stored.DateModified = DateTime.UtcNow;
                break;

            // The stored text already holds this body, or the half is a second original the import refuses: leave it.
            case
            {
                Action: DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation
                or DraftTextAction.SecondOriginal
            }:
                break;

            // A create's refusal, which a re-import never plans.
            case { Action: DraftTextAction.NoOriginalForNewProblem or DraftTextAction.NewProblemMissingMetadata }:
                throw new InvalidOperationException(
                    $"A re-import of '{existing.Slug}' planned {half.Action}, which only a create can be refused for.");

            // Unhandled cases.
            default:
                throw new ArgumentOutOfRangeException(nameof(half), half.Action, "Unknown text action.");
        }
    }

    /// <summary>
    /// Adds one fresh <see cref="ProblemText"/> row for a problem.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="problemId">The owning problem's id.</param>
    /// <param name="documentType">Which half this text is.</param>
    /// <param name="text">The draft text variant (its language and originality).</param>
    /// <param name="markdown">The rewritten markdown to store.</param>
    private static void AddText(
        MathCompsDbContext context,
        Guid problemId,
        DocumentType documentType,
        DraftTextContent text,
        string markdown) =>
        // Markdown-native imports store only MarkdownText — there's no TeX original, so RawText stays null.
        context.ProblemTexts.Add(new ProblemText
        {
            ProblemId = problemId,
            DocumentType = documentType,
            Language = text.Language,
            IsOriginal = text.Original,
            MarkdownText = markdown,
            DateModified = DateTime.UtcNow
        });

    /// <summary>
    /// Resolves author names to entities in order, get-or-creating each by slug. A run-scoped cache means a name
    /// shared across problems is looked up once; duplicates by name are accepted (no global de-dup beyond slug).
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="authorNames">The author display names, in order.</param>
    /// <param name="authorsCache">The run-scoped slug → author cache.</param>
    /// <returns>The author entities in the same order.</returns>
    private static async Task<List<Author>> ResolveAuthorsAsync(
        MathCompsDbContext context, ImmutableArray<string> authorNames, IDictionary<string, Author> authorsCache)
    {
        // Preserve the declared order in the result.
        var resolved = new List<Author>(capacity: authorNames.Length);

        // Each name in turn.
        foreach (var authorName in authorNames)
        {
            // The slug is the identity; the cache spares repeat lookups for a name shared across problems.
            var authorSlug = authorName.ToSlug();
            if (!authorsCache.TryGetValue(authorSlug, out var author))
            {
                // Reuse the DB row if the author already exists, otherwise create one.
                author = await context.Authors.FirstOrDefaultAsync(candidate => candidate.Slug == authorSlug);
                if (author is null)
                {
                    author = new Author { Name = authorName, Slug = authorSlug };
                    await context.Authors.AddAsync(author);
                }

                // Cache it for the rest of the run.
                authorsCache[authorSlug] = author;
            }

            // Keep order.
            resolved.Add(author);
        }

        // The ordered authors.
        return resolved;
    }

    /// <summary>
    /// Replaces an existing problem's authors with the draft's, in the draft's order. The old rows are deleted and
    /// flushed before the new ones are added, so the <c>(problem, ordinal)</c> unique index can't be transiently
    /// violated within one statement batch.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its authors loaded.</param>
    /// <param name="authorNames">The draft's author names, in order.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <returns>A task completing once the old rows are flushed and the new ones added.</returns>
    private static async Task ReplaceAuthorsAsync(
        MathCompsDbContext context,
        Problem existing,
        ImmutableArray<string> authorNames,
        IDictionary<string, Author> authorsCache)
    {
        // The authors the draft wants, in order.
        var desired = await ResolveAuthorsAsync(context, authorNames, authorsCache);

        // Replace wholesale, re-adding in the draft's order with 1-based ordinals.
        await context.ReplaceRowsAsync(
            existing.ProblemAuthors,
            desired.Select((author, index) => new ProblemAuthor
            {
                ProblemId = existing.Id,
                AuthorId = author.Id,
                Ordinal = index + 1
            }));
    }

    /// <summary>
    /// Replaces an existing problem's tags with the draft's, each written as a <see cref="ProblemTag.HumanAssigned"/>
    /// assignment, since every draft slug was reviewed before the import.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its tags loaded.</param>
    /// <param name="tagSlugs">The draft's tag slugs.</param>
    /// <param name="tagsCache">The run-scoped tag cache.</param>
    /// <returns>A task completing once the old rows are flushed and the new ones added.</returns>
    private static async Task ReplaceTagsAsync(
        MathCompsDbContext context,
        Problem existing,
        ImmutableArray<string> tagSlugs,
        IDictionary<string, Tag> tagsCache)
    {
        // The tags the draft wants, get-or-created from the approved vocabulary.
        var desired = await ResolveTagsAsync(context, TagVocabulary.DistinctCanonical(tagSlugs), tagsCache);

        // Replace wholesale — the draft is the source of truth.
        await context.ReplaceRowsAsync(
            existing.ProblemTagsAll,
            desired.Select(tag => ProblemTag.HumanAssigned(existing.Id, tag.Id)));
    }

    /// <summary>
    /// Resolves the categories a draft's block recommends its problem for to the organization's categories of those
    /// names. A block naming one the organization doesn't list is refused before anything is filed, so every name
    /// resolves.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="organizationId">The organization whose pool the problem is filed in.</param>
    /// <param name="proposal">The draft's block.</param>
    /// <returns>The categories' ids.</returns>
    private static async Task<List<Guid>> ResolveCategoriesAsync(
        MathCompsDbContext context, Guid organizationId, DraftProposal proposal)
    {
        // The names the block gives, each once.
        var names = proposal.Recommended.Distinct().ToList();

        // The organization's categories of those names.
        return await context.OrganizationCategories
            .Where(category => category.OrganizationId == organizationId && names.Contains(category.Name))
            .Select(category => category.Id)
            .ToListAsync();
    }

    /// <summary>
    /// Resolves tag slugs to entities, get-or-creating each by slug and deriving its <see cref="TagType"/> from the
    /// approved vocabulary. A run-scoped cache means a slug shared across problems is looked up once.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="slugs">The distinct canonical slugs to resolve.</param>
    /// <param name="tagsCache">The run-scoped slug → tag cache.</param>
    /// <returns>The tag entities.</returns>
    private static async Task<List<Tag>> ResolveTagsAsync(
        MathCompsDbContext context, ImmutableArray<string> slugs, IDictionary<string, Tag> tagsCache)
    {
        // Accumulate the resolved tags.
        var resolved = new List<Tag>(capacity: slugs.Length);

        // Walk the slugs, resolving each to its Tag.
        foreach (var slug in slugs)
        {
            // Cache miss — resolve the tag.
            if (!tagsCache.TryGetValue(slug, out var tag))
            {
                // Reuse the existing DB row when the tag is already there.
                tag = await context.Tags.FirstOrDefaultAsync(candidate => candidate.Slug == slug);
                if (tag is null)
                {
                    // Preflight has already rejected unknown slugs, so the vocabulary must resolve the category.
                    var tagType = TagVocabulary.TryGetTagType(slug)
                        ?? throw new InvalidOperationException($"Tag slug '{slug}' is not in the approved vocabulary.");

                    // Create it from the vocabulary category.
                    tag = new Tag { Slug = slug, TagType = tagType };
                    await context.Tags.AddAsync(tag);
                }

                // Cache it for the rest of the run.
                tagsCache[slug] = tag;
            }

            // Collect it in input order.
            resolved.Add(tag);
        }

        // The resolved tags, one per input slug.
        return resolved;
    }

    /// <summary>
    /// Pushes every figure to remote storage under its key, letting the tracker skip the ones already there.
    /// </summary>
    /// <param name="figures">Each figure's local file and the key it uploads under.</param>
    /// <returns>How many were pushed and how many skipped.</returns>
    private async Task<ImageUploads> UploadFiguresAsync(IReadOnlyList<(string LocalPath, string Key)> figures)
    {
        // Push each figure in turn, counting the ones that actually went up.
        var uploaded = await figures.ToAsyncEnumerable().CountAsync(async (figure, _) =>
            await uploader.Value.UploadIfChangedAsync(figure.LocalPath, figure.Key));

        // Everything that didn't go up was already there.
        return new ImageUploads(uploaded, figures.Count - uploaded);
    }

    /// <summary>
    /// Decides what keeps one problem of a draft for the proposals out of the pool. A problem new to the pool enters
    /// it only through its block. A taken place keeps the problem already there, which a live proposal of the draft's
    /// organization has to file, under the block's number where it carries one. No other problem's proposal in that
    /// organization's pool may hold the block's number. And the block recommends the problem only for categories that
    /// organization lists.
    /// </summary>
    /// <param name="slug">The would-be problem slug, naming its place.</param>
    /// <param name="proposal">The draft's block, or null when it carries none.</param>
    /// <param name="organizationId">
    /// The organization whose pool the draft files its problems in, or null where it names none that exists.
    /// </param>
    /// <param name="isPlaceTaken">Whether a problem already holds the place.</param>
    /// <param name="stored">
    /// The proposal filing the problem at the place, with its organization, or null when none does.
    /// </param>
    /// <param name="holderByNumber">
    /// The proposals in the pool of the draft's organization holding the numbers the draft names, with their problems,
    /// keyed by number.
    /// </param>
    /// <param name="categoryNames">
    /// The names of the categories the draft's organization lists, in the order they run.
    /// </param>
    /// <returns>The problem's conflicts, empty when it files cleanly.</returns>
    private static IEnumerable<ProposalConflict> ClassifyProposal(
        string slug,
        DraftProposal? proposal,
        Guid? organizationId,
        bool isPlaceTaken,
        Proposal? stored,
        IReadOnlyDictionary<int, Proposal> holderByNumber,
        IReadOnlyList<string> categoryNames)
    {
        // A taken place whose proposal is another organization's.
        if (stored is not null && organizationId is not null && stored.OrganizationId != organizationId)
        {
            // Refused for that alone.
            yield return new PlaceHoldsAnotherPoolsProposal(slug, stored.Number, stored.Organization.Slug);

            // The checks below weigh the draft against its own organization's pool, which the place isn't in.
            yield break;
        }

        // A new problem on a free place, with no block to file it in the pool.
        if (!isPlaceTaken && proposal is null)
            yield return new PoolProblemWithoutProposal(slug);

        // A taken place whose problem no proposal files.
        if (isPlaceTaken && stored is null)
            yield return new PlaceHoldsNoProposal(slug);

        // The checks below weigh the draft against its organization's pool, so a draft naming none that exists
        // stops here.
        if (organizationId is null)
            yield break;

        // A taken place whose proposal the reviewers deleted.
        if (stored is { DeletedAt: not null })
            yield return new ProposalDeleted(slug, stored.Number);

        // A taken place whose live proposal goes by another number than the block's.
        if (stored is { DeletedAt: null } && proposal is not null && proposal.Number != stored.Number)
            yield return new PlaceHoldsAnotherProposal(slug, stored.Number, proposal.Number);

        // Another problem's proposal in the organization's pool holding the block's number.
        if (proposal is not null
            && holderByNumber.TryGetValue(proposal.Number, out var holder)
            && holder.Problem.Slug != slug)
            yield return new ProposalNumberTaken(slug, proposal.Number, holder.Problem.Slug);

        // Each category the block names that the organization doesn't list.
        foreach (var category in proposal?.Recommended.Where(name => !categoryNames.Contains(name)) ?? [])
            yield return new ProposalCategoryUnknown(slug, category, categoryNames);
    }

    /// <summary>
    /// The reason the import refuses to create a problem, pinned on its first text.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <returns>The refusal, or null when the create is clean.</returns>
    /// <exception cref="InvalidOperationException">The problem carries no text at all.</exception>
    private static ProblemTextResolution? CreateConflictOf(string slug, DraftProblemContent problem) =>
        problem switch
        {
            // Nothing in the way of the create
            { CreateConflict: null } => null,

            // A refusal, pinned on the first text
            { CreateConflict: { } conflict, Texts: [var firstText, ..] } =>
                new ProblemTextResolution(slug, DocumentType.Statement, firstText.Language, conflict),

            // A problem with no text at all, which the preflight refuses before any import runs
            _ => throw new InvalidOperationException($"Problem '{slug}' carries no text to import.")
        };

    /// <summary>
    /// Decides what is wrong with the organization a draft names: a draft for the proposals has to name one that
    /// exists, and a draft anywhere else has to name none.
    /// </summary>
    /// <param name="isProposalsRound">Whether the draft lands in a round of the proposals.</param>
    /// <param name="organizationSlug">The organization slug the draft names, or null where it names none.</param>
    /// <param name="organizationId">The id of the organization going by that slug, or null where none does.</param>
    /// <returns>What is wrong, or null when nothing is.</returns>
    private static DraftOrganizationProblem? OrganizationProblemOf(
        bool isProposalsRound, string? organizationSlug, Guid? organizationId) =>
        (isProposalsRound, organizationSlug, organizationId) switch
        {
            // A draft for the proposals has to name the pool it fills
            (true, null, _) => DraftOrganizationProblem.Missing,

            // A draft for the proposals has to name an organization that exists
            (true, not null, null) => DraftOrganizationProblem.Unknown,

            // A draft anywhere else fills no pool
            (false, not null, _) => DraftOrganizationProblem.OutsidePool,

            // A draft for the proposals naming an existing organization, or any other draft naming none
            _ => null,
        };

    /// <summary>
    /// What raising the round did: the row, what became of it, and the refusal of a draft that would move the embargo
    /// of a round a group runs.
    /// </summary>
    /// <param name="Entity">The round.</param>
    /// <param name="Action">Whether it was reused unchanged, updated in place, or created.</param>
    /// <param name="EmbargoDisagreement">
    /// How the draft's embargo differs from the one a group stamped on the round, or null when no group runs it or the
    /// two agree.
    /// </param>
    private sealed record RoundResolution(
        Round Entity,
        ResolutionAction Action,
        HostedEmbargoDisagreement? EmbargoDisagreement);

    /// <summary>
    /// The round as it would stand once the import lands, in the ways its group or its readers could be let down.
    /// </summary>
    /// <param name="MissingOrders">
    /// The orders missing from <c>1..N</c>, empty when none is or the round may run with gaps.
    /// </param>
    /// <param name="CountDisagreement">
    /// How the round's count would sit against its group's promise, or null when no group runs it or the two agree.
    /// </param>
    private sealed record RoundAfterImport(
        ImmutableArray<int> MissingOrders,
        HostedGroupCountDisagreement? CountDisagreement);
}
