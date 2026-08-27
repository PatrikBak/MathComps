namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One note in the cross-conversation feed, carrying enough of where it was written to be read without opening the
/// conversation it came from.
/// </summary>
/// <param name="Note"><inheritdoc cref="AdminNoteDto" path="/summary"/></param>
/// <param name="Target"><inheritdoc cref="AdminDefenseTarget" path="/summary"/></param>
/// <param name="User">The student who held the conversation it was written about.</param>
/// <param name="TurnSequence">
/// Where in the conversation the reply it is against sits, or null when it is against the conversation as a whole.
/// </param>
public record AdminNoteFeedItemDto(
    AdminNoteDto Note, AdminDefenseTarget Target, AdminDefenseUserDto User, int? TurnSequence);
