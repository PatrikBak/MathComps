namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One student the review queue can be filtered to.
/// </summary>
/// <param name="User">The student.</param>
/// <param name="ConversationCount">How many conversations they have held.</param>
public record AdminDefenseStudentOptionDto(UserIdentityDto User, int ConversationCount);
