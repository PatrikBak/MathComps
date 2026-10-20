using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Selection;
using MathComps.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using MathComps.Shared.Extensions;
using MathComps.Domain.Tagging;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftApplyService"/>. Spins up one tracking
/// <see cref="MathCompsDbContext"/>, raises the competition node and season the draft's path names through the
/// <see cref="ICompetitionTreeWriter"/>, uploads images through the <see cref="ITrackedFileUploader"/> (which skips
/// ones already on remote storage) and rewrites their refs, then inserts the new problems with the proposals filing
/// them, carries out the <see cref="ProblemReimport"/> plan on the existing ones, and saves once at the end.
/// </summary>
/// <param name="dbContextFactory">Factory for the tracking write context.</param>
/// <param name="tree">Raises the competition node and the season the draft names.</param>
/// <param name="uploader">Remote storage for the problem images, skipping ones unchanged since their last upload.</param>
public class DraftApplyService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    ICompetitionTreeWriter tree,
    ITrackedFileUploader uploader) : IDraftApplyService
{
    /// <inheritdoc/>
    public async Task<DraftApplyResult> ApplyAsync(
        DraftTarget target,
        DateOnly date,
        DateTimeOffset? visibleSince,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder)
    {
        // One tracking context for the whole run.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Upsert the taxonomy chain, collecting the create-vs-reuse outcome of each entity for the report.
        var entities = ImmutableArray.CreateBuilder<EntityResolution>();

        // Raise every node on the competition's path, renumbering each generation to the registry on the way down. The
        // renumbering runs before anything is created, so a mid-list insertion frees the slot the newcomer claims.
        var (competition, chain, sortOrderChanges) = await tree.ResolveNodeAsync(context, target.CompetitionPath);
        entities.AddRange(chain);

        // Season by start year.
        var (season, seasonAction) = await tree.GetOrCreateSeasonAsync(context, target.SeasonYear);
        entities.Add(new EntityResolution("season", target.SeasonYear.ToString(), seasonAction));

        // The round — this competition's sitting in this season — carrying the draft's date and visibility.
        var (round, roundAction) = await GetOrCreateRoundAsync(
            context, competition.Id, target.CompetitionPath, season.Id, date, visibleSince);
        entities.Add(new EntityResolution("round", $"{target.CompetitionPath} {target.SeasonYear}", roundAction));

        // A round the site runs owes its group a fixed number of problems; refuse before a single one is written.
        await EnsureHostedProblemCountAsync(context, round, target.CompetitionPath, problems);

        // Write the problems, tallying the per-text outcomes and the insert/update/image counts.
        var appliedTexts = ImmutableArray.CreateBuilder<AppliedText>();
        var authorsCache = new Dictionary<string, Author>();
        var tagsCache = new Dictionary<string, Tag>();
        var problemsInserted = 0;
        var problemsUpdated = 0;
        var problemsUnchanged = 0;
        var imagesUploaded = 0;
        var imagesSkipped = 0;

        // Each problem in turn.
        foreach (var problem in problems)
        {
            // The stable slug this problem upserts on.
            var slug = target.ProblemSlug(problem.Order);

            // Upload the problem's images and build the relative-ref → media-ref map the markdown rewrite consumes.
            var (replacements, uploaded, skipped) = await UploadProblemImagesAsync(problem, slug, draftFolder);
            imagesUploaded += uploaded;
            imagesSkipped += skipped;

            // The existing problem with its stored content, or null when this slug is net-new.
            var existing = await ProblemReimport.IncludeStoredContent(context.Problems)
                .SingleOrDefaultAsync(candidate => candidate.Slug == slug);

            // Insert a net-new problem, or reconcile an existing one against the draft.
            if (existing is null)
            {
                // Insert the new problem with its texts, authors, and tags.
                await InsertProblemAsync(
                    context, problem, slug, round.Id, replacements, authorsCache, tagsCache, appliedTexts);

                // Count it as an insert.
                problemsInserted++;
            }
            else
            {
                // An existing problem counts as updated only when the draft actually differs from it.
                var changed = await UpdateProblemAsync(
                    context, existing, problem, replacements, authorsCache, tagsCache, appliedTexts);

                // Tally it as updated or unchanged.
                if (changed)
                    problemsUpdated++;
                else
                    problemsUnchanged++;
            }
        }

        // Persist everything still pending. Author reconciliation may have flushed earlier; this catches the rest.
        await context.SaveChangesAsync();

        // The run summary.
        return new DraftApplyResult(
            entities.ToImmutable(), appliedTexts.ToImmutable(),
            problemsInserted, problemsUpdated, problemsUnchanged, imagesUploaded, imagesSkipped,
            sortOrderChanges);
    }

    /// <summary>
    /// Get-or-creates the round by (competition node, season), stamping the draft's date and visibility on a fresh
    /// row and refreshing a stale one: an existing round differing from the draft in either is updated in place so
    /// a corrected <c>_meta</c> actually lands, matching how the authors/tags reconcilers bring stored rows into
    /// line. Both fields are written from the draft, so dropping an embargo from <c>_meta</c> lifts the stored one,
    /// on every round but one the site runs itself: there the group's declaration owns the instant.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="competitionId">The id of the competition node whose problems these are.</param>
    /// <param name="competitionPath">The path of that node.</param>
    /// <param name="seasonId">The season's id.</param>
    /// <param name="date">The round date from <c>_meta</c>.</param>
    /// <param name="visibleSince">The embargo instant from <c>_meta</c>, null when it names none.</param>
    /// <returns>The entity and whether it was reused unchanged, updated in place, or created.</returns>
    /// <exception cref="InvalidOperationException">The draft would move the embargo of a round a group runs.</exception>
    private static async Task<(Round Entity, ResolutionAction Action)> GetOrCreateRoundAsync(
        MathCompsDbContext context, Guid competitionId, string competitionPath, Guid seasonId, DateOnly date,
        DateTimeOffset? visibleSince)
    {
        // The existing round for this (competition node, season), or null when net-new.
        var existing = await context.Rounds.FirstOrDefaultAsync(
            round => round.CompetitionId == competitionId && round.SeasonId == seasonId);

        // Found it — reuse it when it already matches the draft, otherwise refresh the stale fields in place.
        if (existing is not null)
        {
            // Already carries both of the draft's values — reuse it untouched.
            if (existing.Date == date && existing.VisibleSince == visibleSince)
                return (existing, ResolutionAction.Reuse);

            // A round the site runs is held back by its group's closing instant, so writing the draft's over it
            // would open a live competition's problems to everybody who can sign in, spending no entry.
            if (existing.HostedGroupId is not null && existing.VisibleSince != visibleSince)
                throw new InvalidOperationException(
                    $"Round '{competitionPath}' runs in a hosted group, whose closing instant is what holds its "
                    + "problems back. Match the draft's visibleSince to it, or correct the group manifest.");

            // One of them is stale — overwrite both in place (the tracked entity flushes on save) and report it.
            existing.Date = date;
            existing.VisibleSince = visibleSince;
            return (existing, ResolutionAction.Update);
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
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Refuses an import that would leave a round the site runs itself holding a different number of problems than
    /// its group announces, before a single problem is written. See <see cref="HostedGroupCountDisagreement"/> for
    /// what such a round costs.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="round">The round the draft's problems land in.</param>
    /// <param name="competitionPath">The path of the competition node whose sitting that round is.</param>
    /// <param name="problems">The draft's problems.</param>
    /// <exception cref="InvalidOperationException">
    /// The import would break the group's announced problem count.
    /// </exception>
    private static async Task EnsureHostedProblemCountAsync(
        MathCompsDbContext context, Round round, string competitionPath, IReadOnlyList<DraftProblemContent> problems)
    {
        // A round no group runs answers to nobody for how many problems it holds — a fresh one included, since a
        // group only ever takes a round over by declaration.
        if (round.HostedGroupId is not { } groupId)
            return;

        // The number that group announces.
        var announced = await context.HostedGroups
            .Where(group => group.Id == groupId)
            .Select(group => group.ProblemCount)
            .SingleAsync();

        // The orders the round already holds.
        var existingOrders = await context.Problems
            .Where(problem => problem.RoundId == round.Id)
            .Select(problem => problem.Number)
            .ToListAsync();

        // What the round would hold once this import lands: its own orders plus the draft's, counted once each.
        var postImportCount = existingOrders.Concat(problems.Select(problem => problem.Order)).ToHashSet().Count;

        // A paper the group never promised.
        if (postImportCount != announced)
            throw new InvalidOperationException(
                $"Round '{competitionPath}' runs in a hosted group announcing {announced} problem(s), but this "
                + $"import would leave it holding {postImportCount}. Fix the draft, or correct the group manifest.");
    }

    /// <summary>
    /// Uploads every image a problem references to remote storage and returns the map from each relative ref to its
    /// resolved <c>media:</c> ref — keyed by its content id (see <see cref="ProblemImageRefs.ContentId"/>) so
    /// re-imports overwrite the same object, with the image's intrinsic dimensions carried in the query string.
    /// Images unchanged since their last upload are skipped; the upload-versus-skip tally rides back so the caller
    /// can total it across problems.
    /// </summary>
    /// <param name="problem">The problem whose images to upload.</param>
    /// <param name="slug">The problem slug, the content-id prefix.</param>
    /// <param name="draftFolder">The draft folder the relative refs resolve against.</param>
    /// <returns>The relative-ref → media-ref replacements for the markdown rewrite, plus how many images this
    /// problem actually uploaded versus skipped as unchanged.</returns>
    private async Task<(Dictionary<string, ResolvedImageRef> Replacements, int Uploaded, int Skipped)> UploadProblemImagesAsync(
        DraftProblemContent problem, string slug, string draftFolder)
    {
        // The same ref map the markdown rewrite consumes, derived (slug + intrinsic dims) without any upload.
        var replacements = ProblemImageRefs.BuildReplacements(problem.Images, slug, draftFolder);

        // Push each file to the problems/ prefix the resolver serves, under its deterministic content id, letting
        // the tracker skip ones already on remote storage. Tally the outcomes.
        var uploaded = 0;
        var skipped = 0;
        foreach (var basename in problem.Images)
        {
            var pushed = await uploader.UploadIfChangedAsync(
                Path.Combine(draftFolder, "images", basename), $"problems/{ProblemImageRefs.ContentId(slug, basename)}");
            if (pushed)
                uploaded++;
            else
                skipped++;
        }

        // The full map (a body that uses only some of the images simply leaves the rest unmatched), plus the tally.
        return (replacements, uploaded, skipped);
    }

    /// <summary>
    /// Inserts a brand-new problem with its texts, authors and tags, and the proposal filing it when the draft carries
    /// a block.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="slug">The problem slug.</param>
    /// <param name="roundId">The round the problem hangs off.</param>
    /// <param name="replacements">The image-ref replacements to apply to each body.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="tagsCache">The run-scoped tag cache.</param>
    /// <param name="appliedTexts">The accumulator the written texts are recorded into.</param>
    private static async Task InsertProblemAsync(
        MathCompsDbContext context,
        DraftProblemContent problem,
        string slug,
        Guid roundId,
        IReadOnlyDictionary<string, ResolvedImageRef> replacements,
        IDictionary<string, Author> authorsCache,
        IDictionary<string, Tag> tagsCache,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // A problem the import may not create, whose draft validation should have rejected.
        if (problem.CreateConflict is { } conflict)
            throw new InvalidOperationException(
                $"Refusing to insert '{slug}' ({conflict}) — validation should have rejected this draft.");

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
                AddText(context, newProblem.Id, slug, documentType, text, markdown, appliedTexts);
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
            foreach (var tag in await ResolveTagsAsync(context, DistinctCanonicalSlugs(tagSlugs), tagsCache))
                await context.ProblemTags.AddAsync(NewProblemTag(newProblem.Id, tag.Id));

        // File the problem in the pool when the draft says how.
        if (problem.Proposal is { } proposal)
        {
            // The MathComps organization, whose pool the import files every proposal into.
            var organizationId = await context.Organizations
                .Where(organization => organization.Slug == Organization.MathCompsSlug)
                .Select(organization => organization.Id)
                .SingleAsync();

            // The proposal, the categories in the order they run.
            await context.Proposals.AddAsync(new Proposal
            {
                ProblemId = newProblem.Id,
                OrganizationId = organizationId,
                Number = proposal.Number,
                Title = proposal.Title,
                Area = proposal.Area,
                Recommended = SelectionRules.InCategoryOrder(proposal.Recommended),
            });
        }
    }

    /// <summary>
    /// Carries out the re-import of a draft problem onto the existing one, as <see cref="ProblemReimport"/> plans it:
    /// writes each half, and takes the draft's solution link, authors, tags and proposal filing wherever they differ
    /// from the stored ones.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its stored content loaded.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="replacements">The image-ref replacements to apply to each body.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="tagsCache">The run-scoped tag cache.</param>
    /// <param name="appliedTexts">The accumulator the written texts are recorded into.</param>
    /// <returns>Whether the re-import changes anything about the problem.</returns>
    private static async Task<bool> UpdateProblemAsync(
        MathCompsDbContext context,
        Problem existing,
        DraftProblemContent problem,
        IReadOnlyDictionary<string, ResolvedImageRef> replacements,
        IDictionary<string, Author> authorsCache,
        IDictionary<string, Tag> tagsCache,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // The proposal filing the problem, read only when the draft files it.
        var storedProposal = problem.Proposal is null
            ? null
            : await context.Proposals.SingleOrDefaultAsync(candidate => candidate.ProblemId == existing.Id);

        // What re-importing the draft onto the problem does.
        var plan = ProblemReimport.Plan(problem, existing, storedProposal, replacements);

        // Take the draft's solution link where it differs.
        if (plan.ChangesSolutionLink)
            existing.SolutionLink = problem.SolutionLink;

        // Write each half the draft carries.
        foreach (var half in plan.Halves)
            WriteHalf(context, existing, half, appliedTexts);

        // Credit the draft's authors where they differ.
        if (plan.ChangesAuthors && problem.Authors is { } authorNames)
            await ReplaceAuthorsAsync(context, existing, authorNames, authorsCache);

        // Tag the problem with the draft's tags where they differ.
        if (plan.ChangesTags && problem.Tags is { } tagSlugs)
            await ReplaceTagsAsync(context, existing, tagSlugs, tagsCache);

        // File the problem the way the draft's block does, where the stored proposal files it differently. The number
        // is fixed, and the set-aside mark and the deletion belong to the reviewers once the problem is in the pool.
        if (plan.ChangesProposal && problem.Proposal is { } proposal)
        {
            // A block lands only on a problem a proposal already files.
            if (storedProposal is null)
                throw new InvalidOperationException(
                    $"Refusing to file '{existing.Slug}', which no proposal files — validation should have rejected "
                    + "this draft.");

            // Take the draft's title and area.
            storedProposal.Title = proposal.Title;
            storedProposal.Area = proposal.Area;

            // Take the draft's categories, in the order they run.
            storedProposal.Recommended = SelectionRules.InCategoryOrder(proposal.Recommended);
        }

        // Updated only when the plan changes something.
        return plan.ChangesAnything;
    }

    /// <summary>
    /// Adds one fresh <see cref="ProblemText"/> row for a problem and records it as inserted.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="problemId">The owning problem's id.</param>
    /// <param name="slug">The problem slug, for the applied-text record.</param>
    /// <param name="documentType">Which half this text is.</param>
    /// <param name="text">The draft text variant (its language and originality).</param>
    /// <param name="markdown">The rewritten markdown to store.</param>
    /// <param name="appliedTexts">The accumulator to record into.</param>
    private static void AddText(
        MathCompsDbContext context,
        Guid problemId,
        string slug,
        DocumentType documentType,
        DraftTextContent text,
        string markdown,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
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

        // Record it.
        appliedTexts.Add(new AppliedText(slug, documentType, text.Language, AppliedTextAction.Inserted));
    }

    /// <summary>
    /// Writes one half of a re-import the way its plan says: adds the text, rewrites the stored one in place, or leaves
    /// it, and records the outcome. A half the import may not write throws, since validation refuses its draft.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its texts loaded.</param>
    /// <param name="half">The planned half.</param>
    /// <param name="appliedTexts">The accumulator to record into.</param>
    private static void WriteHalf(
        MathCompsDbContext context,
        Problem existing,
        ReimportedHalf half,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // What the plan says writing the half does.
        switch (half)
        {
            // A text the half lacks in this language: add it.
            case { Action: DraftTextAction.AddOriginal or DraftTextAction.AddTranslation }:
                AddText(context, existing.Id, existing.Slug, half.DocumentType, half.Text, half.Markdown, appliedTexts);
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

                // Record the overwrite.
                appliedTexts.Add(new AppliedText(
                    existing.Slug, half.DocumentType, half.Text.Language, AppliedTextAction.Overwritten));
                break;

            // The stored text already holds this body: record it as unchanged, its DateModified left as it is.
            case { Action: DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation }:
                appliedTexts.Add(new AppliedText(
                    existing.Slug, half.DocumentType, half.Text.Language, AppliedTextAction.Unchanged));
                break;

            // A second original, which validation refuses, or a create's refusal, which a re-import never plans.
            case
            {
                Action: DraftTextAction.SecondOriginal or DraftTextAction.NoOriginalForNewProblem
                or DraftTextAction.NewProblemMissingMetadata
            }:
                throw new InvalidOperationException(
                    $"Refusing to write '{existing.Slug}' {half.DocumentType.ToString().ToLowerInvariant()} "
                    + $"({half.Action}) — validation should have rejected this draft.");

            // Unhandled cases.
            default:
                throw new ArgumentOutOfRangeException(nameof(half), half.Action, "Unknown text action.");
        }
    }

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
        await ReplaceJoinRowsAsync(
            context,
            existing.ProblemAuthors,
            desired.Select((author, index) => new ProblemAuthor
            {
                ProblemId = existing.Id,
                AuthorId = author.Id,
                Ordinal = index + 1
            }));
    }

    /// <summary>
    /// Replaces an existing problem's tags with the draft's. Tags are written at the human-assigned convention (fit
    /// 1.0, no confidence or justification), since every draft slug was reviewed before apply.
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
        var desired = await ResolveTagsAsync(context, DistinctCanonicalSlugs(tagSlugs), tagsCache);

        // Replace wholesale — the draft is the source of truth.
        await ReplaceJoinRowsAsync(
            context,
            existing.ProblemTagsAll,
            desired.Select(tag => NewProblemTag(existing.Id, tag.Id)));
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
    /// Builds a draft-assigned tag row: the human-assigned convention (fit 1.0, no confidence or justification), which
    /// clears the visibility threshold so the tag surfaces immediately.
    /// </summary>
    /// <param name="problemId">The owning problem.</param>
    /// <param name="tagId">The tag to assign.</param>
    /// <returns>The join row to add.</returns>
    private static ProblemTag NewProblemTag(Guid problemId, Guid tagId) =>
        new() { ProblemId = problemId, TagId = tagId, GoodnessOfFit = 1.0f, Confidence = null, Justification = null };

    /// <summary>
    /// Canonicalizes tag slugs (trim + lowercase) and drops duplicates, so two casings of the same slug can't produce
    /// a colliding <c>(problem, tag)</c> row.
    /// </summary>
    /// <param name="slugs">The raw draft slugs.</param>
    /// <returns>The distinct canonical slugs.</returns>
    private static ImmutableArray<string> DistinctCanonicalSlugs(ImmutableArray<string> slugs) =>
        [.. slugs.Select(TagVocabulary.Canonicalize).Distinct()];

    /// <summary>
    /// Replaces a problem's join rows wholesale: deletes the existing rows and flushes before adding the new ones, so
    /// a re-used key (an ordinal, or a <c>(problem, tag)</c> pair) can't transiently violate its unique index within
    /// one statement batch.
    /// </summary>
    /// <typeparam name="TRow">The join-row entity type.</typeparam>
    /// <param name="context">The write context.</param>
    /// <param name="existingRows">The rows to delete.</param>
    /// <param name="newRows">The rows to add after the delete is flushed.</param>
    private static async Task ReplaceJoinRowsAsync<TRow>(
        MathCompsDbContext context, IEnumerable<TRow> existingRows, IEnumerable<TRow> newRows) where TRow : class
    {
        // Drop the old rows and flush so re-used keys can't collide with them.
        context.Set<TRow>().RemoveRange(existingRows);
        await context.SaveChangesAsync();

        // Add the replacements.
        await context.Set<TRow>().AddRangeAsync(newRows);
    }
}
