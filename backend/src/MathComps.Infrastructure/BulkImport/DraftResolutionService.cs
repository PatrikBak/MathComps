using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftResolutionService"/>. Spins up a short-lived, no-tracking
/// <see cref="MathCompsDbContext"/> per call and resolves each taxonomy entity with an <c>AnyAsync</c> existence
/// probe; for the problem halves it loads the existing texts' <c>(document type, language, is-original, markdown)</c>
/// for the slugs that already exist, reproduces the markdown the import would write (the same image-ref rewrite),
/// then classifies each half in memory — including spotting a re-import that changes nothing.
/// </summary>
/// <param name="dbContextFactory">Factory for creating read-only database contexts.</param>
public class DraftResolutionService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IDraftResolutionService
{
    /// <inheritdoc/>
    public async Task<DraftDbPreview> PreviewAsync(
        DraftTarget target, IReadOnlyList<DraftProblemContent> problems, string draftFolder)
    {
        // Read-only context; nothing here writes.
        await using var context = await dbContextFactory.CreateDbContextAsync();

        // Competition resolves by slug
        var competitionExists = await context.Competitions.AsNoTracking()
            .AnyAsync(competition => competition.Slug == target.CompetitionSlug);

        // Season resolves by start year
        var seasonExists = await context.Seasons.AsNoTracking()
            .AnyAsync(season => season.StartYear == target.SeasonYear);

        // Round resolves by composite slug.
        var compositeRoundSlug = TaxonomySlugs.ComposeRoundSlug(
            target.CompetitionSlug, target.CategorySlug, target.RoundSlug);
        var roundExists = await context.Rounds.AsNoTracking()
            .AnyAsync(round => round.CompositeSlug == compositeRoundSlug);

        // Order matters for the preview: competition, then season, then round.
        var resolutions = ImmutableArray.Create(
            new EntityResolution("competition", target.CompetitionSlug, ToAction(competitionExists)),
            new EntityResolution("season", target.SeasonYear.ToString(), ToAction(seasonExists)),
            new EntityResolution("round", compositeRoundSlug, ToAction(roundExists)));

        // Map each draft problem to its would-be slug so we can both probe the DB and report against it. The slug is
        // keyed by the season's edition (ročník); derive it so the probe matches the persisted slug.
        var editionNumber = Season.EditionFromStartYear(target.SeasonYear);
        var slugByOrder = problems.ToDictionary(
            problem => problem.Order,
            problem => TaxonomySlugs.ProblemSlug(editionNumber, compositeRoundSlug, problem.Order));

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

        // Hand back the create-vs-reuse picture plus the per-text resolutions for any colliding slugs.
        return new DraftDbPreview(resolutions, textResolutions);
    }

    /// <summary>
    /// Classifies every half a single problem would write, reproducing the markdown the import would store (the
    /// same image-ref rewrite) so an unchanged re-import can be told apart from a real overwrite. A net-new problem
    /// slug collides with nothing, so it contributes no resolutions.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="problem">The draft problem content — its text variants and image basenames.</param>
    /// <param name="draftFolder">The draft folder the image refs resolve against.</param>
    /// <param name="existingTexts">The existing problem's texts, or null when the problem slug is absent.</param>
    /// <returns>One resolution per half of an already-existing problem; empty for a net-new slug.</returns>
    private static IEnumerable<ProblemTextResolution> ClassifyProblem(
        string slug,
        DraftProblemContent problem,
        string draftFolder,
        IReadOnlyList<ExistingText>? existingTexts)
    {
        // A net-new slug collides with nothing — every half is the quiet path, so report none (and skip the image
        // reads the body comparison would otherwise need).
        if (existingTexts is null)
            return [];

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
        IReadOnlyDictionary<string, string> replacements,
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
