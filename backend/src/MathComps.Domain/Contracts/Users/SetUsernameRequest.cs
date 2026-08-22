using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Contracts.Users;

/// <summary>
/// Request to take a username for the authenticated user.
/// </summary>
/// <param name="Username"><inheritdoc cref="User.Username" path="/summary"/></param>
public record SetUsernameRequest(string Username);
