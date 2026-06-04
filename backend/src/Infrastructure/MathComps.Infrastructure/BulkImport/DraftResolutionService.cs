using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using MathComps.Shared.Localization;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.BulkImport;

/// <summary>
/// EF Core implementation of <see cref="IDraftResolutionService"/>. Spins up a short-lived, no-tracking
/// <see cref="MathCompsDbContext"/> per call and resolves each taxonomy entity with an <c>AnyAsync</c> existence
/// probe; for the problem halves it loads only the existing texts' <c>(document type, language, is-original)</c>
/// for the slugs that already exist, then classifies each half in memory.
/// </summary>
/// <param name="dbContextFactory">Factory for creating read-only database contexts.</param>
public class DraftResolutionService(IDbContextFactory<MathCompsDbContext> dbContextFactory) : IDraftResolutionService
{
    /// <inheritdoc/>
    public async Task<DraftDbPreview> PreviewAsync(DraftTarget target, IReadOnlyList<DraftProblemRef> problems)
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

        // Map each draft problem to its would-be slug so we can both probe the DB and report against it.
        var slugByOrder = problems.ToDictionary(
            problem => problem.Order,
            problem => TaxonomySlugs.ProblemSlug(target.SeasonYear, compositeRoundSlug, problem.Order));

        // Load the existing texts for the slugs that already exist — keyed by slug for the per-half lookup below.
        var candidateSlugs = slugByOrder.Values.ToList();
        var existingTextsBySlug = (await context.Problems.AsNoTracking()
                .Where(problem => candidateSlugs.Contains(problem.Slug))
                .Select(problem => new ExistingProblem(
                    problem.Slug,
                    problem.Texts
                        .Select(text => new ExistingText(text.DocumentType, text.Language, text.IsOriginal))
                        .ToList()))
                .ToListAsync())
            .ToDictionary(existing => existing.Slug, existing => existing.Texts);

        // Classify every half the draft writes (statement always; solution only when present) against what's there.
        var textResolutions = problems
            .SelectMany(problem => DocumentTypesFor(problem)
                .SelectMany(documentType => Classify(
                    slugByOrder[problem.Order],
                    documentType,
                    target,
                    existingTextsBySlug.GetValueOrDefault(slugByOrder[problem.Order]))))
            .ToImmutableArray();

        // Hand back the create-vs-reuse picture plus the per-half resolutions for any colliding slugs.
        return new DraftDbPreview(resolutions, textResolutions);
    }

    /// <summary>
    /// The document types a draft problem would write: a statement always, plus a solution when it carries one.
    /// </summary>
    /// <param name="problem">The draft problem reference.</param>
    /// <returns>The document types the import would persist for it.</returns>
    private static IEnumerable<DocumentType> DocumentTypesFor(DraftProblemRef problem) =>
        problem.HasSolution
            ? [DocumentType.Statement, DocumentType.Solution]
            : [DocumentType.Statement];

    /// <summary>
    /// Decides what importing one half would do, from the draft's original flag and language against the texts
    /// already present for that <c>(slug, document type)</c>. A net-new original half yields nothing (the common,
    /// quiet path); every other case yields exactly one resolution.
    /// </summary>
    /// <param name="slug">The would-be problem slug.</param>
    /// <param name="documentType">The half being classified.</param>
    /// <param name="target">The draft's language and original flag.</param>
    /// <param name="existingTexts">The existing problem's texts, or null when the problem slug is absent.</param>
    /// <returns>Zero or one resolution for this half.</returns>
    private static IEnumerable<ProblemTextResolution> Classify(
        string slug,
        DocumentType documentType,
        DraftTarget target,
        IReadOnlyList<ExistingText>? existingTexts)
    {
        // The existing original (at most one per document type) and whether any text shares the draft's language.
        var existingForDocument = existingTexts?.Where(text => text.DocumentType == documentType).ToList();
        var existingOriginal = existingForDocument?.FirstOrDefault(text => text.IsOriginal);
        var sameLanguageExists = existingForDocument?.Any(text => text.Language == target.Language) ?? false;

        // Perform classification of the original or translation
        var action = target.Original
            ? ClassifyOriginal(existingTexts is null, existingOriginal, target.Language)
            : ClassifyTranslation(existingOriginal is null, sameLanguageExists);

        // A net-new original half is the quiet path — nothing to report.
        if (action is null)
            yield break;

        // Return the final resolution
        yield return new ProblemTextResolution(slug, documentType, target.Language, action.Value);
    }

    /// <summary>
    /// Classifies an original-draft half: a new original where none exists, an in-place overwrite of the
    /// same-language original, or a forbidden second original in a different language. A net-new problem yields
    /// null (nothing to report).
    /// </summary>
    /// <param name="problemAbsent">Whether the problem slug doesn't exist yet.</param>
    /// <param name="existingOriginal">The existing original for this document type, or null when there is none.</param>
    /// <param name="draftLanguage">The language the draft would write.</param>
    /// <returns>The action, or null when there's nothing to report.</returns>
    private static DraftTextAction? ClassifyOriginal(
        bool problemAbsent, ExistingText? existingOriginal, Language draftLanguage)
    {
        // A brand-new problem just gets its original — the quiet, expected path, not worth a line.
        if (problemAbsent)
            return null;

        // The problem exists but this half has no original yet — the import adds it cleanly.
        if (existingOriginal is null)
            return DraftTextAction.AddOriginal;

        // Same-language original already there — a re-import overwrites it in place.
        if (existingOriginal.Language == draftLanguage)
            return DraftTextAction.OverwriteOriginal;

        // A different-language original already holds the slot — a second original is forbidden.
        return DraftTextAction.SecondOriginal;
    }

    /// <summary>
    /// Classifies a translation-draft half: an orphan when no original exists to attach to, an in-place overwrite
    /// of an existing same-language translation, or a clean add otherwise.
    /// </summary>
    /// <param name="noOriginal">Whether this document type has no existing original to attach the translation to.</param>
    /// <param name="sameLanguageExists">Whether a text in the draft's language already exists for this half.</param>
    /// <returns>The action for the translation half.</returns>
    private static DraftTextAction ClassifyTranslation(bool noOriginal, bool sameLanguageExists)
    {
        // No original anywhere for this half — the translation would dangle with nothing to translate.
        if (noOriginal)
            return DraftTextAction.OrphanTranslation;

        // A translation in this language already exists — the import overwrites it in place.
        if (sameLanguageExists)
            return DraftTextAction.OverwriteTranslation;

        // An original exists and this language is new — a clean translation add.
        return DraftTextAction.AddTranslation;
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
    /// One existing problem text reduced to what the conflict check reads.
    /// </summary>
    /// <param name="DocumentType">Which half the text is.</param>
    /// <param name="Language">The text's language.</param>
    /// <param name="IsOriginal">Whether it is the canonical original.</param>
    private record ExistingText(DocumentType DocumentType, Language Language, bool IsOriginal);
}
