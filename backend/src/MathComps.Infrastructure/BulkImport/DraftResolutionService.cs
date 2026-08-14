using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MathComps.Domain.Localization;
using MathComps.Domain.Taxonomy;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftResolutionService"/>. Spins up a short-lived, no-tracking
/// <see cref="MathCompsDbContext"/> per call and resolves each taxonomy entity with an <c>AnyAsync</c> existence
/// probe; for the problem halves it loads the existing texts' <c>(document type, language, is-original, markdown)</c>
/// for the slugs that already exist, reproduces the markdown the import would write (the same image-ref rewrite),
/// then classifies each half in memory — including spotting a re-import that changes nothing. It also loads the
/// round's full set of problem orders to check that the import would leave the round contiguous.
/// </summary>
/// <param name="dbContextFactory">Factory for creating read-only database contexts.</param>
/// <param name="metadata">The registry, source of the structural sort orders the preview reconciles against.</param>
public class DraftResolutionService(
    IDbContextFactory<MathCompsDbContext> dbContextFactory,
    IMetadataLocalizationService metadata) : IDraftResolutionService
{
    /// <inheritdoc/>
    public async Task<DraftDbPreview> PreviewAsync(
        DraftTarget target, IReadOnlyList<DraftProblemContent> problems, string draftFolder)
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

        // Map each draft problem to its would-be slug so we can both probe the DB and report against it. The slug is
        // keyed by the season's edition (ročník); derive it so the probe matches the persisted slug.
        var editionNumber = Season.EditionFromStartYear(target.SeasonYear);
        var slugByOrder = problems.ToDictionary(
            problem => problem.Order,
            problem => TaxonomySlugs.ProblemSlug(editionNumber, target.CompetitionPath, problem.Order));

        // Load the existing texts for the slugs that already exist — keyed by slug for the per-half lookup below.
        var candidateSlugs = slugByOrder.Values.ToList();
        var existingTextsBySlug = (await context.Problems.AsNoTracking()
                .Where(problem => candidateSlugs.Contains(problem.Slug))
                .Select(problem => new ExistingProblem(
                    problem.Slug,
                    problem.Texts
                        .Select(text => new ExistingText(
                            text.DocumentType, text.Language, text.IsOriginal, text.MarkdownText))
                        .ToList()))
                .ToListAsync())
            .ToDictionary(existing => existing.Slug, existing => existing.Texts);

        // Classify every text-variant half the draft writes (statement always; solution only when present).
        var textResolutions = problems
            .SelectMany(problem => ClassifyProblem(
                slugByOrder[problem.Order],
                problem,
                draftFolder,
                existingTextsBySlug.GetValueOrDefault(slugByOrder[problem.Order])))
            .ToImmutableArray();

        // Contiguity is a post-import property: once this import lands, the round's problem orders — those already
        // in the DB plus the draft's — must run 1..N with no gap. Loading every order in the round (not just the
        // draft's candidate slugs) is what lets a fresh import that skipped a problem, or a subset re-import onto a
        // slug that doesn't exist yet, be told apart from a legitimate correction or append.
        var existingOrders = await context.Problems.AsNoTracking()
            .Where(problem => problem.Round.Competition.Path == target.CompetitionPath
                              && problem.Round.Season.StartYear == target.SeasonYear)
            .Select(problem => problem.Number)
            .ToListAsync();

        // The orders present after the import, and the gaps in 1..N that would remain.
        var postImportOrders = existingOrders.Concat(problems.Select(problem => problem.Order)).ToHashSet();
        var highestOrder = postImportOrders.Count == 0 ? 0 : postImportOrders.Max();
        var missingProblemOrders = Enumerable.Range(1, highestOrder)
            .Where(order => !postImportOrders.Contains(order))
            .ToImmutableArray();

        // The taxonomy rows apply would renumber to match the registry, plus any row the registry can't place.
        var (sortOrderChanges, orphans) = await PreviewSortOrderAsync(context, target.CompetitionPath);

        // Hand back the create-vs-reuse picture, the per-text resolutions for colliding slugs, the round's gaps,
        // and the sort-order reconciliation apply would perform.
        return new DraftDbPreview(
            resolutions, textResolutions, missingProblemOrders, sortOrderChanges, orphans);
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
    /// Classifies every half a single problem would write, reproducing the markdown the import would store (the
    /// same image-ref rewrite) so an unchanged re-import can be told apart from a real overwrite. A net-new problem
    /// slug usually collides with nothing and contributes no resolutions — except the two create-time conflicts worth
    /// flagging: a problem with no original body, and one with no <c>pN.yaml</c> sidecar.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="problem">The draft problem content — its text variants and image basenames.</param>
    /// <param name="draftFolder">The draft folder the image refs resolve against.</param>
    /// <param name="existingTexts">The existing problem's texts, or null when the problem slug is absent.</param>
    /// <returns>
    /// One resolution per half of an already-existing problem; for a net-new slug, a single create-conflict
    /// resolution or empty when the create is clean.
    /// </returns>
    private static IEnumerable<ProblemTextResolution> ClassifyProblem(
        string slug,
        DraftProblemContent problem,
        string draftFolder,
        IReadOnlyList<ExistingText>? existingTexts)
    {
        // A net-new slug collides with nothing — importing would create the problem. Most halves are the quiet
        // create path (so we skip the image reads the body comparison would otherwise need), but two net-new shapes
        // are still worth flagging.
        if (existingTexts is null)
        {
            // No bodies to create — the preflight already flagged the empty group; nothing to classify here.
            if (problem.Texts is not [var firstText, ..])
                return [];

            // Bodies but no original — the problem would land with only translations and no canonical original.
            if (!problem.Texts.Any(text => text.Original))
                return [new ProblemTextResolution(
                    slug, DocumentType.Statement, firstText.Language, DraftTextAction.NoOriginalForNewProblem)];

            // A fresh problem with no pN.yaml sidecar forgot its metadata (a re-import may omit it, but this slug
            // doesn't exist yet, so this is a create).
            if (!problem.HasSidecar)
                return [new ProblemTextResolution(
                    slug, DocumentType.Statement, firstText.Language, DraftTextAction.NewProblemMissingMetadata)];

            // Otherwise a clean create — nothing to flag.
            return [];
        }

        // The image-ref → media-ref map the would-be markdown is rewritten against, sized off the draft's figures.
        var replacements = ProblemImageRefs.BuildReplacements(problem.Images, slug, draftFolder);

        // Classify each variant's halves against the rows already present.
        return problem.Texts.SelectMany(text => ClassifyHalves(slug, text, replacements, existingTexts));
    }

    /// <summary>
    /// Classifies the halves one text variant of an existing problem would write: a statement always, plus a
    /// solution when the draft carries one.
    /// </summary>
    /// <param name="slug">The problem slug.</param>
    /// <param name="text">The draft text variant.</param>
    /// <param name="replacements">The image-ref replacements the bodies are rewritten against.</param>
    /// <param name="existingTexts">The existing problem's texts.</param>
    /// <returns>One resolution per half the variant writes.</returns>
    private static IEnumerable<ProblemTextResolution> ClassifyHalves(
        string slug,
        DraftTextContent text,
        IReadOnlyDictionary<string, ResolvedImageRef> replacements,
        IReadOnlyList<ExistingText> existingTexts)
    {
        // The statement half — classified against its rewritten body.
        yield return Classify(slug, DocumentType.Statement, text,
            MarkdownImageRewriter.Rewrite(text.StatementMarkdown, replacements), existingTexts);

        // The solution half, only when the draft carries one.
        if (text.SolutionMarkdown is { } solutionMarkdown)
            yield return Classify(slug, DocumentType.Solution, text,
                MarkdownImageRewriter.Rewrite(solutionMarkdown, replacements), existingTexts);
    }

    /// <summary>
    /// Decides what importing one half of an already-existing problem would do, from that text's originality and
    /// language and whether its would-be body differs from the row it lands on.
    /// </summary>
    /// <param name="slug">The problem slug.</param>
    /// <param name="documentType">The half being classified.</param>
    /// <param name="text">The draft text variant — its language and whether it is the original.</param>
    /// <param name="markdown">The would-be stored markdown for this half (image refs already rewritten).</param>
    /// <param name="existingTexts">The existing problem's texts.</param>
    /// <returns>The resolution for this half.</returns>
    private static ProblemTextResolution Classify(
        string slug,
        DocumentType documentType,
        DraftTextContent text,
        string markdown,
        IReadOnlyList<ExistingText> existingTexts)
    {
        // The texts already present for this half, the existing original among them, and the same-language row the
        // import would land on (matched on language alone, regardless of originality).
        var existingForDocument = existingTexts.Where(existing => existing.DocumentType == documentType).ToList();
        var existingOriginal = existingForDocument.FirstOrDefault(existing => existing.IsOriginal);
        var sameLanguageRow = existingForDocument.FirstOrDefault(existing => existing.Language == text.Language);

        // Classify the original or the translation against the rows present.
        var action = text.Original
            ? ClassifyOriginal(existingOriginal, text.Language, markdown)
            : ClassifyTranslation(sameLanguageRow, markdown);

        // Pair it with the slug, half and language.
        return new ProblemTextResolution(slug, documentType, text.Language, action);
    }

    /// <summary>
    /// Classifies an original-draft half against an existing problem: a new original where none exists, an unchanged
    /// or in-place overwrite of the same-language original, or a forbidden second original in a different language.
    /// </summary>
    /// <param name="existingOriginal">The existing original for this document type, or null when there is none.</param>
    /// <param name="draftLanguage">The language the draft would write.</param>
    /// <param name="markdown">The would-be stored markdown, compared against the existing original's body.</param>
    /// <returns>The action this half would take.</returns>
    private static DraftTextAction ClassifyOriginal(
        ExistingText? existingOriginal, Language draftLanguage, string markdown)
    {
        // The problem exists but this half has no original yet — the import adds it cleanly.
        if (existingOriginal is null)
            return DraftTextAction.AddOriginal;

        // A different-language original already holds the slot — a second original is forbidden.
        if (existingOriginal.Language != draftLanguage)
            return DraftTextAction.SecondOriginal;

        // Same-language original — an identical body changes nothing, otherwise it's an in-place overwrite.
        return existingOriginal.MarkdownText == markdown
            ? DraftTextAction.UnchangedOriginal
            : DraftTextAction.OverwriteOriginal;
    }

    /// <summary>
    /// Classifies a translation half against an existing problem: a clean add when this language is new, otherwise
    /// an unchanged or in-place overwrite of the same-language text.
    /// </summary>
    /// <param name="sameLanguageRow">The same-language text already present for this half, or null when none.</param>
    /// <param name="markdown">The would-be stored markdown, compared against the existing text's body.</param>
    /// <returns>The action this half would take.</returns>
    private static DraftTextAction ClassifyTranslation(ExistingText? sameLanguageRow, string markdown)
    {
        // The problem exists and this language is new — a clean translation add.
        if (sameLanguageRow is null)
            return DraftTextAction.AddTranslation;

        // A same-language text already exists — an identical body changes nothing, otherwise an in-place overwrite.
        return sameLanguageRow.MarkdownText == markdown
            ? DraftTextAction.UnchangedTranslation
            : DraftTextAction.OverwriteTranslation;
    }

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
    /// An existing problem reduced to the slug and the texts the preview classifies against.
    /// </summary>
    /// <param name="Slug">The problem's slug.</param>
    /// <param name="Texts">Its texts, each reduced to the fields the classification needs.</param>
    private record ExistingProblem(string Slug, IReadOnlyList<ExistingText> Texts);

    /// <summary>
    /// One existing problem text reduced to what the conflict and content checks read.
    /// </summary>
    /// <param name="DocumentType">Which half the text is.</param>
    /// <param name="Language">The text's language.</param>
    /// <param name="IsOriginal">Whether it is the canonical original.</param>
    /// <param name="MarkdownText">The stored markdown body, compared against the would-be import to spot a no-op.</param>
    private record ExistingText(DocumentType DocumentType, Language Language, bool IsOriginal, string? MarkdownText);
}
