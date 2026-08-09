namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Somebody the review surface names: the student who held a conversation, or the reviewer who wrote a note about
/// one. The name alone doesn't identify anyone, since two people can share one and a deleted account keeps a
/// placeholder, so the address rides alongside it.
/// </summary>
/// <param name="Id">Their identifier.</param>
/// <param name="DisplayName">What they are called.</param>
/// <param name="Email">Their address, or null once their account is deleted.</param>
public record AdminDefenseUserDto(Guid Id, string DisplayName, string? Email);
