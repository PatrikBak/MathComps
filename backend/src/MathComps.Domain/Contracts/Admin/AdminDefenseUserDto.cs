namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Somebody the review surface names: the student who held a conversation, or the reviewer who wrote a note about
/// one. The username can be missing, so the address rides alongside it; a deleted account has neither.
/// </summary>
/// <param name="Id">Their identifier.</param>
/// <param name="Username">
/// The name the site calls them by, or null when they have chosen none or their account is deleted.
/// </param>
/// <param name="Email">Their address, or null once their account is deleted.</param>
public record AdminDefenseUserDto(Guid Id, string? Username, string? Email);
