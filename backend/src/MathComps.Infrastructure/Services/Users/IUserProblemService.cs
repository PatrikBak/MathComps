namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Defines the contract for managing user-problem interactions.
/// </summary>
public interface IUserProblemService
{
    /// <summary>
    /// Creates a like if it doesn't exist, removes it if it does.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="problemId">The internal ID of the problem.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task ToggleLikeAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a mark if it doesn't exist, removes it if it does.
    /// </summary>
    /// <param name="userId">The internal ID of the user.</param>
    /// <param name="problemId">The internal ID of the problem.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    Task ToggleMarkAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default);
}
