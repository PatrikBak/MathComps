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
/// <param name="IsSetAside"><inheritdoc cref="Proposal.IsSetAside" path="/summary"/></param>
/// <param name="IsUsed">Whether a paper has taken it.</param>
public record ProposalDto(
    Guid Id,
    int Number,
    string Title,
    ProposalArea Area,
    IReadOnlyList<HostedCompetitionCategory> Recommended,
    IReadOnlyDictionary<Language, ProposalTextDto> Texts,
    bool IsSetAside,
    bool IsUsed);
