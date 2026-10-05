using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Reads what accounts have been allowed past the site's ordinary rules.
/// </summary>
public interface IUserGrantService
{
    /// <summary>
    /// Whether an account holds a capability. A grant stands until it is revoked, so every rule reads it
    /// afresh.
    /// </summary>
    /// <param name="userId">The account the capability is read for.</param>
    /// <param name="capability">The capability being read for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>Whether they hold it.</returns>
    Task<bool> HasAsync(Guid userId, UserCapability capability, CancellationToken cancellationToken = default);

    /// <summary>
    /// When an account was handed a capability it holds.
    /// </summary>
    /// <param name="userId">The account the capability is read for.</param>
    /// <param name="capability">The capability being read for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>When it was handed over, or null where the account does not hold it.</returns>
    Task<DateTimeOffset?> GetGrantedAtAsync(
        Guid userId, UserCapability capability, CancellationToken cancellationToken = default);

    /// <summary>
    /// When each of several accounts was handed a capability it holds.
    /// </summary>
    /// <param name="userIds">The accounts the capability is read for.</param>
    /// <param name="capability">The capability being read for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>When it was handed over, by account, for the ones among them who hold it.</returns>
    Task<IReadOnlyDictionary<Guid, DateTimeOffset>> GetGrantedAtAsync(
        IReadOnlyCollection<Guid> userIds, UserCapability capability, CancellationToken cancellationToken = default);
}
