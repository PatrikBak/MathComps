using MathComps.Domain.Contracts.Defense;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// Runs and persists a user's AI-examiner defense conversations: opening a session, continuing it turn by turn (each
/// turn runs the examiner engine and records its spend), listing a user's sessions for one problem or across every
/// problem, rewinding one to an earlier point, and deleting one.
/// Guardrails (input sizes, turn count, per-user spend) are enforced before any model call.
/// </summary>
public interface IDefenseSessionService
{
    /// <summary>
    /// Opens a session: seeds the examiner's opener and the student's first message, runs the examiner for its reply,
    /// and returns the full three-turn conversation.
    /// </summary>
    /// <param name="userId">The user opening the session.</param>
    /// <param name="start">The problem being defended and the student's first message.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The created session with its opener, the student turn, and the examiner's reply.</returns>
    Task<DefenseSessionDto> StartAsync(
        Guid userId, DefenseSessionStart start, CancellationToken cancellationToken = default);

    /// <summary>
    /// Continues a session with the student's next message and the examiner's reply to it.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session to continue.</param>
    /// <param name="content">The student's next message.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The session with the two appended turns.</returns>
    Task<DefenseSessionDto> ContinueAsync(
        Guid userId, Guid sessionId, string content, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists a user's sessions against one handout environment, most recently active first, each with its turns.
    /// </summary>
    /// <param name="userId">The user whose sessions to list.</param>
    /// <param name="target">The handout environment to filter to.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The user's sessions against that environment.</returns>
    Task<IReadOnlyList<DefenseSessionDto>> ListAsync(
        Guid userId, HandoutEnvironmentTarget target, CancellationToken cancellationToken = default);

    /// <summary>
    /// Lists all of a user's sessions across every problem, most recently active first, each summarized to its
    /// problem, statement, last activity, and opening student message.
    /// </summary>
    /// <param name="userId">The user whose sessions to list.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>The user's sessions across every problem, most recently active first.</returns>
    Task<IReadOnlyList<DefenseSessionListItemDto>> ListAllAsync(
        Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes a session and its turns outright. The session must belong to the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session to delete.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task DeleteAsync(Guid userId, Guid sessionId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Rewinds a session to a chosen point, deleting every turn after it so the conversation can be taken
    /// from there again. The kept point must be an examiner turn, so the result awaits the student's next
    /// message. The session must belong to the user.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session to rewind.</param>
    /// <param name="keepThroughSequence">The sequence of the last turn to keep; every later turn is deleted.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    Task RewindAsync(
        Guid userId, Guid sessionId, int keepThroughSequence, CancellationToken cancellationToken = default);
}

/// <summary>
/// Thrown when a session does not exist, or exists but belongs to another user (indistinguishable to the caller).
/// </summary>
public sealed class DefenseSessionNotFoundException() : Exception("Defense session not found");

/// <summary>
/// Thrown when a submitted message or problem text exceeds its configured length cap.
/// </summary>
public sealed class DefenseMessageTooLongException() : Exception("The message is too long");

/// <summary>
/// Thrown when the student's message is blank — there's nothing to defend.
/// </summary>
public sealed class DefenseMessageEmptyException() : Exception("The message is empty");

/// <summary>
/// Thrown when a conversation has reached its configured turn limit and cannot be continued.
/// </summary>
public sealed class DefenseTurnLimitException() : Exception("This defense has reached its turn limit");

/// <summary>
/// Thrown when the user has reached their configured daily spend ceiling.
/// </summary>
public sealed class DefenseSpendLimitException() : Exception("You have reached your usage limit — try again later");

/// <summary>
/// Thrown when a rewind names no cut point at all, or names one that is out of range or is not an examiner
/// turn (so the result would not await the student's next message).
/// </summary>
public sealed class DefenseRewindTargetException() : Exception("The rewind point is not valid");
