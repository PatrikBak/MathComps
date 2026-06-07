using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services;
using MathComps.Infrastructure.Storage;
using MathComps.Shared.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftApplyService"/>. Spins up one tracking
/// <see cref="MathCompsDbContext"/>, get-or-creates each taxonomy entity by slug (structural fields sourced from
/// <see cref="IMetadataLocalizationService"/>), uploads images through the <see cref="ITrackedFileUploader"/> (which
/// skips ones already on remote storage) and rewrites their refs, then inserts or overwrites the problems and saves
/// once at the end.
/// </summary>
/// <param name="dbContextFactory">Factory for the tracking write context.</param>
/// <param name="metadata">The registry, source of the structural sort-order / default-round fields.</param>
/// <param name="uploader">Remote storage for the problem images, skipping ones unchanged since their last upload.</param>
public class DraftApplyService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService metadata,
    ITrackedFileUploader uploader) : IDraftApplyService
{
    /// <inheritdoc/>
    public async Task<DraftApplyResult> ApplyAsync(
        DraftTarget target,
        DateOnly date,
        IReadOnlyList<DraftProblemContent> problems,
        string draftFolder)
    {
        // One tracking context for the whole run.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // The composite slug keys both the round lookup and every problem slug, so derive it once.
        var compositeRoundSlug = TaxonomySlugs.ComposeRoundSlug(
            target.CompetitionSlug, target.CategorySlug, target.RoundSlug);

        // Upsert the taxonomy chain, collecting the create-vs-reuse outcome of each entity for the report.
        var entities = ImmutableArray.CreateBuilder<EntityResolution>();

        // Competition by slug.
        var (competition, competitionAction) = await GetOrCreateCompetitionAsync(context, target.CompetitionSlug);
        entities.Add(new EntityResolution("competition", target.CompetitionSlug, competitionAction));

        // Category by slug, only when the competition carries one.
        Guid? categoryId = null;
        if (target.CategorySlug is { } categorySlug)
        {
            var (category, categoryAction) = await GetOrCreateCategoryAsync(context, categorySlug);
            categoryId = category.Id;
            entities.Add(new EntityResolution("category", categorySlug, categoryAction));
        }

        // Round by composite slug, with the structural fields off the registry.
        var (round, roundAction) = await GetOrCreateRoundAsync(
            context, target, compositeRoundSlug, competition.Id, categoryId);
        entities.Add(new EntityResolution("round", compositeRoundSlug, roundAction));

        // Season by start year.
        var (season, seasonAction) = await GetOrCreateSeasonAsync(context, target.SeasonYear);
        entities.Add(new EntityResolution("season", target.SeasonYear.ToString(), seasonAction));

        // Round-instance by (round, season), carrying the draft's date when freshly created.
        var (roundInstance, roundInstanceAction) = await GetOrCreateRoundInstanceAsync(
            context, round.Id, season.Id, date);
        entities.Add(new EntityResolution(
            "round-instance", $"{compositeRoundSlug} {target.SeasonYear}", roundInstanceAction));

        // Write the problems, tallying the per-text outcomes and the insert/update/image counts.
        var appliedTexts = ImmutableArray.CreateBuilder<AppliedText>();
        var authorsCache = new Dictionary<string, Author>();
        var problemsInserted = 0;
        var problemsUpdated = 0;
        var problemsUnchanged = 0;
        var imagesUploaded = 0;
        var imagesSkipped = 0;

        // Each problem in turn.
        foreach (var problem in problems)
        {
            // The stable slug this problem upserts on — its leading token is the season's edition (ročník), e.g. 75.
            var slug = TaxonomySlugs.ProblemSlug(
                Season.EditionFromStartYear(target.SeasonYear), compositeRoundSlug, problem.Order);

            // Upload the problem's images and build the relative-ref → media-ref map the markdown rewrite consumes.
            var (replacements, uploaded, skipped) = await UploadProblemImagesAsync(problem, slug, draftFolder);
            imagesUploaded += uploaded;
            imagesSkipped += skipped;

            // The existing problem (with its texts and authors), or null when this slug is net-new.
            var existing = await context.Problems
                .Include(candidate => candidate.Texts)
                .Include(candidate => candidate.ProblemAuthors)
                .SingleOrDefaultAsync(candidate => candidate.Slug == slug);

            // Insert a fresh problem, or reconcile the existing one — which may turn out to change nothing.
            if (existing is null)
            {
                await InsertProblemAsync(
                    context, problem, slug, roundInstance.Id, replacements, authorsCache, appliedTexts);
                problemsInserted++;
            }
            else
            {
                // An existing problem counts as updated only when the draft actually differs from it.
                var changed = await UpdateProblemAsync(
                    context, existing, problem, replacements, authorsCache, appliedTexts);
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
            problemsInserted, problemsUpdated, problemsUnchanged, imagesUploaded, imagesSkipped);
    }

    /// <summary>
    /// Get-or-creates the competition by slug, sourcing a new row's sort order from the registry.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="slug">The competition slug.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    private async Task<(Competition Entity, ResolutionAction Action)> GetOrCreateCompetitionAsync(
        MathCompsDbContext context, string slug)
    {
        // Reuse the existing row when present.
        var existing = await context.Competitions.FirstOrDefaultAsync(competition => competition.Slug == slug);
        if (existing is not null)
            return (existing, ResolutionAction.Reuse);

        // Otherwise create it, the sort order taken from its position in the registry.
        var created = new Competition { Slug = slug, SortOrder = metadata.Shared.CompetitionSortOrder(slug) };
        await context.Competitions.AddAsync(created);
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Get-or-creates the category by slug, sourcing a new row's sort order from the registry.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="slug">The category slug.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    private async Task<(Category Entity, ResolutionAction Action)> GetOrCreateCategoryAsync(
        MathCompsDbContext context, string slug)
    {
        // Reuse the existing row when present.
        var existing = await context.Categories.FirstOrDefaultAsync(category => category.Slug == slug);
        if (existing is not null)
            return (existing, ResolutionAction.Reuse);

        // Otherwise create it, the sort order taken from the registry's global category list.
        var created = new Category { Slug = slug, SortOrder = metadata.Shared.CategorySortOrder(slug) };
        await context.Categories.AddAsync(created);
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Get-or-creates the round by composite slug, sourcing a new row's structural fields (slug, sort order,
    /// default flag) from the registry.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="target">The draft taxonomy.</param>
    /// <param name="compositeRoundSlug">The round's composite slug, its lookup key.</param>
    /// <param name="competitionId">The owning competition's id.</param>
    /// <param name="categoryId">The owning category's id, or null when the competition has no categories.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    private async Task<(Round Entity, ResolutionAction Action)> GetOrCreateRoundAsync(
        MathCompsDbContext context,
        DraftTarget target,
        string compositeRoundSlug,
        Guid competitionId,
        Guid? categoryId)
    {
        // Reuse the existing round when present.
        var existing = await context.Rounds.FirstOrDefaultAsync(round => round.CompositeSlug == compositeRoundSlug);
        if (existing is not null)
            return (existing, ResolutionAction.Reuse);

        // The competition's registry entry — its round list is what decides default-vs-explicit below.
        var competition = metadata.Shared.Competition(target.CompetitionSlug);

        // No explicit rounds means the one round is the synthetic default (e.g. IMO).
        var isDefault = competition.HasDefaultRound;

        // The explicit round's slug, or null for the default round. A competition that carries rounds always
        // arrives here with a slug — registry validation rejects a draft that omits one — so a missing slug is
        // a guarded invariant breach, not a routine case.
        var roundSlug = isDefault
            ? null
            : target.RoundSlug ?? throw new InvalidOperationException(
                $"Competition '{target.CompetitionSlug}' carries explicit rounds but the draft specified no round.");

        // Build the row. A default round takes an empty slug and sorts first; an explicit one takes the draft's
        // slug and its position among the competition's rounds. The rest are the foreign keys and lookup key.
        var created = new Round
        {
            CompetitionId = competitionId,
            CategoryId = categoryId,
            Slug = roundSlug ?? "",
            CompositeSlug = compositeRoundSlug,
            SortOrder = competition.RoundSortOrder(roundSlug),
            IsDefault = isDefault
        };

        // Track the new row and report it as created.
        await context.Rounds.AddAsync(created);
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Get-or-creates the season by start year, deriving a new row's <see cref="Season.EditionNumber"/> via
    /// <see cref="Season.EditionFromStartYear"/>.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="startYear">The season's start year.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    private static async Task<(Season Entity, ResolutionAction Action)> GetOrCreateSeasonAsync(
        MathCompsDbContext context, int startYear)
    {
        // Reuse the existing season when present.
        var existing = await context.Seasons.FirstOrDefaultAsync(season => season.StartYear == startYear);
        if (existing is not null)
            return (existing, ResolutionAction.Reuse);

        // Otherwise create it, the edition number being the shared ročník derived from the year.
        var created = new Season { StartYear = startYear, EditionNumber = Season.EditionFromStartYear(startYear) };
        await context.Seasons.AddAsync(created);
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Get-or-creates the round-instance by (round, season), setting the draft's date on a fresh row.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="roundId">The round's id.</param>
    /// <param name="seasonId">The season's id.</param>
    /// <param name="date">The round-instance date from <c>_meta</c>.</param>
    /// <returns>The entity and whether it was reused or created.</returns>
    private static async Task<(RoundInstance Entity, ResolutionAction Action)> GetOrCreateRoundInstanceAsync(
        MathCompsDbContext context, Guid roundId, Guid seasonId, DateOnly date)
    {
        // Reuse the existing round-instance when present (its date is left as-is).
        var existing = await context.RoundInstances.FirstOrDefaultAsync(
            instance => instance.RoundId == roundId && instance.SeasonId == seasonId);
        if (existing is not null)
            return (existing, ResolutionAction.Reuse);

        // Otherwise create it with the draft's date.
        var created = new RoundInstance { RoundId = roundId, SeasonId = seasonId, Date = date };
        await context.RoundInstances.AddAsync(created);
        return (created, ResolutionAction.Create);
    }

    /// <summary>
    /// Uploads every image a problem references to remote storage and returns the map from each relative ref to its
    /// resolved <c>media:</c> ref — keyed <c>{slug}-{stem}</c> so re-imports overwrite the same object, with the
    /// SVG's intrinsic dimensions carried in the query string. Images unchanged since their last upload are skipped;
    /// the upload-versus-skip tally rides back so the caller can total it across problems.
    /// </summary>
    /// <param name="problem">The problem whose images to upload.</param>
    /// <param name="slug">The problem slug, the content-id prefix.</param>
    /// <param name="draftFolder">The draft folder the relative refs resolve against.</param>
    /// <returns>The relative-ref → media-ref replacements for the markdown rewrite, plus how many images this
    /// problem actually uploaded versus skipped as unchanged.</returns>
    private async Task<(Dictionary<string, string> Replacements, int Uploaded, int Skipped)> UploadProblemImagesAsync(
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
    /// Inserts a brand-new problem and all of its texts and authors.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="slug">The problem slug.</param>
    /// <param name="roundInstanceId">The round-instance the problem hangs off.</param>
    /// <param name="replacements">The image-ref replacements to apply to each body.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="appliedTexts">The accumulator the written texts are recorded into.</param>
    private static async Task InsertProblemAsync(
        MathCompsDbContext context,
        DraftProblemContent problem,
        string slug,
        Guid roundInstanceId,
        IReadOnlyDictionary<string, string> replacements,
        IDictionary<string, Author> authorsCache,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // The new problem row.
        var newProblem = new Problem
        {
            Number = problem.Order,
            RoundInstanceId = roundInstanceId,
            Slug = slug,
            SolutionLink = problem.SolutionLink
        };
        await context.Problems.AddAsync(newProblem);

        // Each language variant contributes a statement (always) and a solution (when present).
        foreach (var text in problem.Texts)
        {
            // The statement half — rewrite its image refs and add it.
            AddText(context, newProblem.Id, slug, DocumentType.Statement, text,
                MarkdownImageRewriter.Rewrite(text.StatementMarkdown, replacements), appliedTexts);

            // The solution half, only when the draft carries one.
            if (text.SolutionMarkdown is { } solutionMarkdown)
                AddText(context, newProblem.Id, slug, DocumentType.Solution, text,
                    MarkdownImageRewriter.Rewrite(solutionMarkdown, replacements), appliedTexts);
        }

        // Resolve the draft's authors to entities, in declared order.
        var authors = await ResolveAuthorsAsync(context, problem.Authors, authorsCache);

        // One ProblemAuthor per author, the ordinal 1-based in that order.
        for (var index = 0; index < authors.Count; index++)
            await context.ProblemAuthors.AddAsync(new ProblemAuthor
            {
                ProblemId = newProblem.Id,
                AuthorId = authors[index].Id,
                Ordinal = index + 1
            });
    }

    /// <summary>
    /// Reconciles an existing problem with the draft: refreshes its solution link, upserts each text by
    /// <c>(document type, language)</c>, and reconciles its authors.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with texts and authors loaded.</param>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="replacements">The image-ref replacements to apply to each body.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <param name="appliedTexts">The accumulator the written texts are recorded into.</param>
    /// <returns>Whether anything actually changed — false when the draft matched the stored problem exactly.</returns>
    private static async Task<bool> UpdateProblemAsync(
        MathCompsDbContext context,
        Problem existing,
        DraftProblemContent problem,
        IReadOnlyDictionary<string, string> replacements,
        IDictionary<string, Author> authorsCache,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // The solution link is the only language-invariant field a re-import may change.
        var linkChanged = existing.SolutionLink != problem.SolutionLink;
        existing.SolutionLink = problem.SolutionLink;

        // Upsert each variant's halves against the rows already present, noting whether any actually changed.
        var textsChanged = false;
        foreach (var text in problem.Texts)
        {
            // The statement half — rewrite its image refs and upsert it.
            textsChanged |= UpsertText(context, existing, DocumentType.Statement, text,
                MarkdownImageRewriter.Rewrite(text.StatementMarkdown, replacements), appliedTexts);

            // The solution half, only when the draft carries one.
            if (text.SolutionMarkdown is { } solutionMarkdown)
                textsChanged |= UpsertText(context, existing, DocumentType.Solution, text,
                    MarkdownImageRewriter.Rewrite(solutionMarkdown, replacements), appliedTexts);
        }

        // Bring the author set into line with the draft.
        var authorsChanged = await ReconcileAuthorsAsync(context, existing, problem.Authors, authorsCache);

        // Updated only if the link, some text, or the author set moved.
        return linkChanged || textsChanged || authorsChanged;
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
    /// Upserts one half of an existing problem: a clean add when the <c>(document type, language)</c> row is
    /// absent, an in-place rewrite when its stored markdown differs, or a no-op when it already matches.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its texts loaded.</param>
    /// <param name="documentType">Which half this text is.</param>
    /// <param name="text">The draft text variant.</param>
    /// <param name="markdown">The rewritten markdown to store.</param>
    /// <param name="appliedTexts">The accumulator to record into.</param>
    /// <returns>Whether the row was added or rewritten — false when it already held this exact markdown.</returns>
    private static bool UpsertText(
        MathCompsDbContext context,
        Problem existing,
        DocumentType documentType,
        DraftTextContent text,
        string markdown,
        ImmutableArray<AppliedText>.Builder appliedTexts)
    {
        // The same-language row for this half, if any.
        var match = existing.Texts.FirstOrDefault(
            candidate => candidate.DocumentType == documentType && candidate.Language == text.Language);

        // No same-language row — add it, after ruling out a second original.
        if (match is null)
        {
            // A different-language original already holds the one-original slot — forbidden.
            if (text.Original && existing.Texts.Any(candidate => candidate.DocumentType == documentType
                    && candidate.IsOriginal && candidate.Language != text.Language))
                throw new InvalidOperationException(
                    $"Refusing to write a second original for '{existing.Slug}' "
                    + $"{documentType.ToString().ToLowerInvariant()} — validation should have rejected this draft.");

            // A clean add onto the existing problem — a real change.
            AddText(context, existing.Id, existing.Slug, documentType, text, markdown, appliedTexts);
            return true;
        }

        // The row already holds this exact markdown — leave it (and its DateModified) untouched.
        if (match.MarkdownText == markdown)
        {
            appliedTexts.Add(new AppliedText(existing.Slug, documentType, text.Language, AppliedTextAction.Unchanged));
            return false;
        }

        // The content differs — overwrite its markdown in place.
        match.MarkdownText = markdown;
        match.DateModified = DateTime.UtcNow;
        appliedTexts.Add(new AppliedText(existing.Slug, documentType, text.Language, AppliedTextAction.Overwritten));
        return true;
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
    /// Brings an existing problem's author set into line with the draft. A no-op when the authors and their order
    /// already match; otherwise the old rows are deleted and flushed before the new ones are added, so the
    /// <c>(problem, ordinal)</c> unique index can't be transiently violated within one statement batch.
    /// </summary>
    /// <param name="context">The write context.</param>
    /// <param name="existing">The tracked existing problem, with its authors loaded.</param>
    /// <param name="authorNames">The draft's author names, in order.</param>
    /// <param name="authorsCache">The run-scoped author cache.</param>
    /// <returns>Whether the author rows changed — false when they already matched the draft.</returns>
    private static async Task<bool> ReconcileAuthorsAsync(
        MathCompsDbContext context,
        Problem existing,
        ImmutableArray<string> authorNames,
        IDictionary<string, Author> authorsCache)
    {
        // The authors the draft wants, in order.
        var desired = await ResolveAuthorsAsync(context, authorNames, authorsCache);

        // Already correct — same authors, same order — so leave the rows alone.
        var current = existing.ProblemAuthors.OrderBy(problemAuthor => problemAuthor.Ordinal)
            .Select(problemAuthor => problemAuthor.AuthorId);
        if (current.SequenceEqual(desired.Select(author => author.Id)))
            return false;

        // Replace wholesale: drop the old rows and flush, so re-numbered ordinals can't collide with the old ones.
        context.ProblemAuthors.RemoveRange(existing.ProblemAuthors);
        await context.SaveChangesAsync();

        // Re-add in the draft's order, 1-based.
        for (var index = 0; index < desired.Count; index++)
            await context.ProblemAuthors.AddAsync(new ProblemAuthor
            {
                ProblemId = existing.Id,
                AuthorId = desired[index].Id,
                Ordinal = index + 1
            });

        // The set moved.
        return true;
    }
}
