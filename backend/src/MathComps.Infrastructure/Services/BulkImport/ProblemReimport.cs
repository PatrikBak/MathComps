using System.Collections.Immutable;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Domain.Tagging;
using MathComps.Shared.Extensions;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.BulkImport;

/// <summary>
/// One half a draft text writes onto a problem that already exists, with what writing it does to the stored texts.
/// </summary>
/// <param name="DocumentType">The half (statement, solution or hints).</param>
/// <param name="Text">The draft text the half comes from.</param>
/// <param name="Markdown">The markdown the half stores, its image refs rewritten.</param>
/// <param name="SameLanguageText">
/// The stored text of the half in the draft text's language, or null when the half has none.
/// </param>
/// <param name="Action">What writing the half does to the stored texts.</param>
public record ReimportedHalf(
    DocumentType DocumentType,
    DraftTextContent Text,
    string Markdown,
    ProblemText? SameLanguageText,
    DraftTextAction Action);

/// <summary>
/// What re-importing a draft problem onto the problem already at its slug does: every half the draft writes and what
/// writing it does, and which of the fields the draft declares differ from the stored ones. A field the draft omits is
/// left as it is, so it never differs.
/// </summary>
/// <param name="Halves">Every half the draft writes, in draft order.</param>
/// <param name="ChangesSolutionLink">Whether the draft names a solution link other than the stored one.</param>
/// <param name="ChangesAuthors">Whether the draft credits other authors, or the same ones in another order.</param>
/// <param name="ChangesTags">Whether the draft tags the problem with a different set.</param>
/// <param name="ChangesProposal">
/// Whether the draft's proposal block files the problem differently than the stored proposal does.
/// </param>
public record ProblemReimport(
    ImmutableArray<ReimportedHalf> Halves,
    bool ChangesSolutionLink,
    bool ChangesAuthors,
    bool ChangesTags,
    bool ChangesProposal)
{
    /// <summary>
    /// Whether the re-import changes the problem at all: a half it adds or rewrites, or a field that differs.
    /// </summary>
    public bool ChangesAnything =>
        // Some half writes its row, or some field moves
        Halves.Any(half => Writes(half.Action))
        || ChangesSolutionLink || ChangesAuthors || ChangesTags || ChangesProposal;

    /// <summary>
    /// Makes a problems query load everything a plan compares the draft against: the texts, and the authors and tags,
    /// which a plan compares by slug.
    /// </summary>
    /// <param name="problems">The problems to read.</param>
    /// <returns>The same problems, carrying their stored content.</returns>
    public static IQueryable<Problem> IncludeStoredContent(IQueryable<Problem> problems) =>
        // The texts, the credited authors and the tags
        problems
            .Include(problem => problem.Texts)
            .Include(problem => problem.ProblemAuthors).ThenInclude(problemAuthor => problemAuthor.Author)
            .Include(problem => problem.ProblemTagsAll).ThenInclude(problemTag => problemTag.Tag);

    /// <summary>
    /// Makes a proposals query load what a plan compares a draft's block against beyond the proposal's own fields:
    /// the categories it is recommended for, which a plan compares by name.
    /// </summary>
    /// <param name="proposals">The proposals query.</param>
    /// <returns>The same proposals, carrying their recommendations.</returns>
    public static IQueryable<Proposal> IncludeStoredRecommendations(IQueryable<Proposal> proposals) =>
        // The recommendations with their categories
        proposals.Include(proposal => proposal.Recommendations).ThenInclude(recommendation => recommendation.Category);

    /// <summary>
    /// Decides what re-importing a draft problem onto the stored one does.
    /// </summary>
    /// <param name="problem">The draft problem content.</param>
    /// <param name="existing">
    /// The problem already at the draft problem's slug, loaded through <see cref="IncludeStoredContent"/>.
    /// </param>
    /// <param name="storedProposal">
    /// The proposal filing that problem, loaded through <see cref="IncludeStoredRecommendations"/>, or null when none
    /// does.
    /// </param>
    /// <param name="replacements">The image-ref replacements the draft's bodies are rewritten against.</param>
    /// <returns>The plan.</returns>
    public static ProblemReimport Plan(
        DraftProblemContent problem,
        Problem existing,
        Proposal? storedProposal,
        IReadOnlyDictionary<string, ResolvedImageRef> replacements)
    {
        // Every half each draft text writes, with what writing it does to the stored texts.
        var halves = problem.Texts
            .SelectMany(text => text.HalvesToWrite(replacements)
                .Select(half => ClassifyHalf(existing, text, half.DocumentType, half.Markdown)))
            .ToImmutableArray();

        // A link other than the stored one.
        var changesLink = problem.SolutionLink is { } solutionLink && solutionLink != existing.SolutionLink;

        // The stored authors by slug, in credit order.
        var storedAuthorSlugs = existing.ProblemAuthors
            .OrderBy(problemAuthor => problemAuthor.Ordinal)
            .Select(problemAuthor => problemAuthor.Author.Slug);

        // Authors other than the stored ones, a name being the author its slug identifies.
        var changesAuthors = problem.Authors is { } authorNames
            && !authorNames.Select(name => name.ToSlug()).SequenceEqual(storedAuthorSlugs);

        // A tag set other than the stored one.
        var changesTags = problem.Tags is { } tagSlugs
            && !tagSlugs.Select(TagVocabulary.Canonicalize).ToHashSet()
                .SetEquals(existing.ProblemTagsAll.Select(problemTag => problemTag.Tag.Slug));

        // A block filing the problem differently than its stored proposal does.
        var changesProposal = problem.Proposal is { } proposal
            && (storedProposal is null || !proposal.Matches(storedProposal));

        // The plan.
        return new ProblemReimport(halves, changesLink, changesAuthors, changesTags, changesProposal);
    }

    /// <summary>
    /// Decides what writing one half of a draft text onto the stored problem does, from the text's originality and
    /// language and whether its body differs from the stored text it lands on.
    /// </summary>
    /// <param name="existing">The stored problem, with its texts.</param>
    /// <param name="text">The draft text the half comes from.</param>
    /// <param name="documentType">The half.</param>
    /// <param name="markdown">The markdown the half stores, its image refs rewritten.</param>
    /// <returns>The half, with what writing it does.</returns>
    private static ReimportedHalf ClassifyHalf(
        Problem existing, DraftTextContent text, DocumentType documentType, string markdown)
    {
        // The stored texts of the half, its original among them, and the one in the draft text's language.
        var storedHalf = existing.Texts.Where(stored => stored.DocumentType == documentType).ToList();
        var storedOriginal = storedHalf.FirstOrDefault(stored => stored.IsOriginal);
        var sameLanguageText = storedHalf.FirstOrDefault(stored => stored.Language == text.Language);

        // An original answers to the half's stored original. A half holding no original but a text in the draft's
        // language takes the body into that text, the way a translation would.
        var action = text.Original && (storedOriginal is not null || sameLanguageText is null)
            ? ClassifyOriginal(storedOriginal, text.Language, markdown)
            : ClassifyTranslation(sameLanguageText, markdown);

        // The half with its outcome.
        return new ReimportedHalf(documentType, text, markdown, sameLanguageText, action);
    }

    /// <summary>
    /// Classifies an original half against the stored problem: a new original where none exists, an unchanged or
    /// in-place overwrite of the same-language original, or a forbidden second original in a different language.
    /// </summary>
    /// <param name="storedOriginal">The half's stored original, or null when there is none.</param>
    /// <param name="draftLanguage">The language the draft would write.</param>
    /// <param name="markdown">The markdown the half stores, compared against the stored original's body.</param>
    /// <returns>What writing the half does.</returns>
    private static DraftTextAction ClassifyOriginal(
        ProblemText? storedOriginal, Language draftLanguage, string markdown)
    {
        // The problem exists but this half has no original yet, so the import adds it cleanly.
        if (storedOriginal is null)
            return DraftTextAction.AddOriginal;

        // A different-language original already holds the slot, and a second original is forbidden.
        if (storedOriginal.Language != draftLanguage)
            return DraftTextAction.SecondOriginal;

        // Same-language original: an identical body changes nothing, otherwise it's an in-place overwrite.
        return storedOriginal.MarkdownText == markdown
            ? DraftTextAction.UnchangedOriginal
            : DraftTextAction.OverwriteOriginal;
    }

    /// <summary>
    /// Classifies a translation half against the stored problem: a clean add when this language is new, otherwise an
    /// unchanged or in-place overwrite of the same-language text.
    /// </summary>
    /// <param name="sameLanguageText">The stored text of the half in this language, or null when there is none.</param>
    /// <param name="markdown">The markdown the half stores, compared against the stored text's body.</param>
    /// <returns>What writing the half does.</returns>
    private static DraftTextAction ClassifyTranslation(ProblemText? sameLanguageText, string markdown)
    {
        // The problem exists and this language is new: a clean translation add.
        if (sameLanguageText is null)
            return DraftTextAction.AddTranslation;

        // A same-language text already exists: an identical body changes nothing, otherwise an in-place overwrite.
        return sameLanguageText.MarkdownText == markdown
            ? DraftTextAction.UnchangedTranslation
            : DraftTextAction.OverwriteTranslation;
    }

    /// <summary>
    /// Whether a half counts as changing its stored texts. Every action does but an unchanged re-import, a refused one
    /// included.
    /// </summary>
    /// <param name="action">What writing the half does.</param>
    /// <returns>False only when the stored text already holds the half's body.</returns>
    private static bool Writes(DraftTextAction action) => action switch
    {
        DraftTextAction.UnchangedOriginal or DraftTextAction.UnchangedTranslation => false,
        DraftTextAction.AddOriginal or DraftTextAction.OverwriteOriginal or DraftTextAction.SecondOriginal
            or DraftTextAction.AddTranslation or DraftTextAction.OverwriteTranslation
            or DraftTextAction.NoOriginalForNewProblem or DraftTextAction.NewProblemMissingMetadata => true,
        _ => throw new ArgumentOutOfRangeException(nameof(action), action, "Unknown text action.")
    };
}
