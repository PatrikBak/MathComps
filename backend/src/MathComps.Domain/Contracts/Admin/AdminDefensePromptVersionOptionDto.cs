namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// One set of examiner settings the review queue can be filtered to, standing in for "conversations run on this
/// prompt".
/// </summary>
/// <param name="Version">The settings' version key.</param>
/// <param name="FirstSeenAt">When a conversation first ran on these settings.</param>
/// <param name="LastSeenAt">When one last did.</param>
/// <param name="ConversationCount">How many have run on them.</param>
public record AdminDefensePromptVersionOptionDto(
    string Version, DateTimeOffset FirstSeenAt, DateTimeOffset LastSeenAt, int ConversationCount);
