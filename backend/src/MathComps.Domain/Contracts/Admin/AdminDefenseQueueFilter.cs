namespace MathComps.Domain.Contracts.Admin;

/// <summary>
/// Which conversations the review queue shows. Every field starts at not narrowing, and the notes filter is the only
/// one that can also narrow to the absence of what it names.
/// </summary>
/// <param name="Unread">True to show only conversations with turns newer than when they were last read.</param>
/// <param name="HasNotes">True for conversations carrying notes, false for those carrying none, null for both.</param>
/// <param name="StudentReported">True to show only conversations where the student reported a reply.</param>
/// <param name="StudentFeedback">True to show only conversations the student left feedback on.</param>
/// <param name="UserId">Whose conversations to show, or null for everyone's.</param>
/// <param name="HandoutContentId">Which handout's conversations to show, or null for every handout's.</param>
/// <param name="EnvironmentId">
/// Which environment within that handout to show, or null for every environment in it. Only meaningful alongside
/// <paramref name="HandoutContentId"/>, since an environment's id is unique only within its own handout.
/// </param>
/// <param name="WithinDays">
/// How recently the conversation must have moved, in days, or null for however long ago.
/// </param>
/// <param name="PromptVersion">
/// Which examiner settings the conversation ran on, or null for any of them.
/// </param>
public record AdminDefenseQueueFilter(
    bool Unread,
    bool? HasNotes,
    bool StudentReported,
    bool StudentFeedback,
    Guid? UserId,
    string? HandoutContentId,
    string? EnvironmentId,
    int? WithinDays,
    string? PromptVersion);
