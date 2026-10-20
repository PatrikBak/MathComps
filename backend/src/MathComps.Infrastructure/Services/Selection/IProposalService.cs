using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Selection;

/// <summary>
/// Changes what the reviewers record about the proposals. Every change runs after every one before it has
/// finished, so none of them acts on a state another is moving.
/// </summary>
public interface IProposalService
{
    /// <summary>
    /// Sets a proposal aside, or brings it back.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose pool the proposal is in.
    /// </param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="isSetAside">Whether the proposal should be set aside.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no live proposal of the organization's pool has the id.
    /// </exception>
    Task SetAsideAsync(
        string organizationSlug, Guid proposalId, bool isSetAside, CancellationToken cancellationToken = default);

    /// <summary>
    /// Recommends a proposal for one category, or takes the recommendation back, leaving the other categories as
    /// they stand.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose pool the proposal is in.
    /// </param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="category">The category, by its <see cref="OrganizationCategory.Name"/>.</param>
    /// <param name="isRecommended">Whether the proposal should be recommended for <paramref name="category"/>.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no live proposal of the organization's pool has the id, or the organization lists no category of
    /// the name.
    /// </exception>
    Task SetRecommendedAsync(
        string organizationSlug, Guid proposalId, string category, bool isRecommended,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets one reviewer's rating of a proposal to the scores given, replacing whatever they gave before. Leaving
    /// out both scores takes the rating back.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose pool the proposal is in.
    /// </param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="raterId">The reviewer rating it.</param>
    /// <param name="beauty">
    /// How beautiful the reviewer finds it, from <see cref="ProposalRating.MinScore"/> to
    /// <see cref="ProposalRating.MaxScore"/> in tenths; null for no score.
    /// </param>
    /// <param name="difficulty">
    /// How difficult the reviewer finds it, from <see cref="ProposalRating.MinScore"/> to
    /// <see cref="ProposalRating.MaxScore"/> in tenths; null for no score.
    /// </param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the change is saved.</returns>
    /// <exception cref="ProposalRatingValueException">
    /// Thrown when a score is off the scale or between its steps.
    /// </exception>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no live proposal of the organization's pool has the id.
    /// </exception>
    Task RateAsync(
        string organizationSlug, Guid proposalId, Guid raterId, decimal? beauty, decimal? difficulty,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a proposal from the selection, emptying every slot it stands in. Its problem and conversations stay
    /// where they are, and the reviewers' discussion of it closes with it.
    /// </summary>
    /// <param name="organizationSlug">
    /// The <see cref="Organization.Slug"/> of the organization whose pool the proposal is in.
    /// </param>
    /// <param name="proposalId">The proposal.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>A task that completes once the deletion is saved.</returns>
    /// <exception cref="SelectionTargetNotFoundException">
    /// Thrown when no live proposal of the organization's pool has the id.
    /// </exception>
    /// <exception cref="SelectionProposalUsedException">Thrown when a paper has taken it.</exception>
    Task DeleteAsync(string organizationSlug, Guid proposalId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when an id or a category's name names nothing the selection holds, a reviewer's conversation about a
/// proposal included.
/// </summary>
public sealed class SelectionTargetNotFoundException()
    : Exception("Nothing in the selection answers to that id or name");

/// <summary>
/// Thrown when a write would take or delete a problem a paper has already taken, which only the board holding it
/// may move.
/// </summary>
public sealed class SelectionProposalUsedException() : Exception("A paper has already taken this problem");

/// <summary>
/// Thrown when a rating would hold a score off its scale or between its steps.
/// </summary>
public sealed class ProposalRatingValueException() : Exception("The rating is not valid");
