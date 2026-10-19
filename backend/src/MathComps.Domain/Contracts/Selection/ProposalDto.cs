using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;

namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// One proposed problem, as a reviewer reads it.
/// </summary>
/// <param name="Id">The problem's identifier, which is also the proposal's.</param>
/// <param name="Number"><inheritdoc cref="Proposal.Number" path="/summary"/></param>
/// <param name="Title"><inheritdoc cref="Proposal.Title" path="/summary"/></param>
/// <param name="Area"><inheritdoc cref="Proposal.Area" path="/summary"/></param>
/// <param name="Recommended"><inheritdoc cref="Proposal.Recommended" path="/summary"/></param>
/// <param name="Texts">
/// Its text in every language it has a statement in, keyed by that language.
/// </param>
/// <param name="OriginalLanguage">
/// The language it was first written in, which its other texts translate; null where none of its texts is marked
/// <see cref="ProblemText.IsOriginal"/>.
/// </param>
/// <param name="IsSetAside"><inheritdoc cref="Proposal.IsSetAside" path="/summary"/></param>
/// <param name="IsUsed">Whether a paper has taken it.</param>
/// <param name="Ratings">
/// Every <see cref="ProposalRating"/> it was given, by the raters' usernames, a rater showing none last.
/// </param>
public record ProposalDto(
    Guid Id,
    int Number,
    string Title,
    ProposalArea Area,
    IReadOnlyList<HostedCompetitionCategory> Recommended,
    IReadOnlyDictionary<Language, ProposalTextDto> Texts,
    Language? OriginalLanguage,
    bool IsSetAside,
    bool IsUsed,
    IReadOnlyList<ProposalRatingDto> Ratings);
