namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Somebody an admin surface names. The username can be missing, so the address rides alongside it.
/// </summary>
/// <param name="Id">Their identifier.</param>
/// <param name="Username">
/// The name the site calls them by, or null when they have chosen none or their account is deleted.
/// </param>
/// <param name="Email">Their address, or null when there is none, as for every deleted account.</param>
public record UserIdentityDto(Guid Id, string? Username, string? Email);
