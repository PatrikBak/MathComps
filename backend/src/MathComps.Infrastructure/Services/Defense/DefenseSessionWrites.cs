using System.Linq.Expressions;

using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// What makes a defense session the caller's, and how a write against one is run: serialized against the user's
/// turns, on a context of its own, and refused outright unless the session is theirs. Shared by every such
/// write, so none of them can be written without the check and they all refuse another user's conversation
/// identically.
/// </summary>
internal static class DefenseSessionWrites
{
    /// <summary>
    /// The condition a session meets when it is the caller's, as one expression so that every write spells it
    /// the same way. Each of them establishes ownership differently, by probing for it, by folding it into the
    /// statement that acts, or by loading nothing else; what they must not differ on is what it means.
    /// </summary>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session in question.</param>
    /// <returns>The condition, for a query to filter on.</returns>
    public static Expression<Func<DefenseSession, bool>> IsOwnedBy(Guid userId, Guid sessionId) =>
        session => session.Id == sessionId && session.UserId == userId;

    /// <summary>
    /// Runs one write against a conversation the caller owns.
    /// </summary>
    /// <param name="dbContextFactory">The factory minting the operation's database context.</param>
    /// <param name="turnGate">Serializes a single user's turns.</param>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session being written against.</param>
    /// <param name="write">The write itself, handed the operation's database context.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <remarks>
    /// The gate is what makes the check worth anything: these writes check and act as separate statements, so
    /// without it a delete or a rewind could interleave between the two and turn a refusal the student would
    /// understand into a foreign-key failure.
    /// </remarks>
    public static async Task ToOwnedSessionAsync(
        IDbContextFactory<MathCompsDbContext> dbContextFactory,
        IDefenseUserTurnGate turnGate,
        Guid userId,
        Guid sessionId,
        Func<MathCompsDbContext, Task> write,
        CancellationToken cancellationToken)
    {
        // Hold this user's turns off for the length of the write.
        using var turnLock = await turnGate.AcquireAsync(userId, cancellationToken);

        // A fresh context for this operation.
        await using var dbContext = await dbContextFactory.CreateDbContextAsync(cancellationToken);

        // Confirm the session is the caller's before reaching into it.
        await EnsureOwnedAsync(dbContext, userId, sessionId, cancellationToken);

        // And do whatever the operation came to do.
        await write(dbContext);
    }

    /// <summary>
    /// Throws unless the session exists and belongs to the user.
    /// </summary>
    /// <param name="dbContext">The operation's database context.</param>
    /// <param name="userId">The user the session must belong to.</param>
    /// <param name="sessionId">The session to check.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <remarks>
    /// Another user's session and a missing one raise the same exception on purpose: telling them apart would let
    /// a caller probe for session ids that exist, which is worth more to them than the distinction is to us.
    /// </remarks>
    private static async Task EnsureOwnedAsync(
        MathCompsDbContext dbContext, Guid userId, Guid sessionId, CancellationToken cancellationToken)
    {
        // Whether a session with this id is the caller's.
        var owned = await dbContext.DefenseSessions.AnyAsync(IsOwnedBy(userId, sessionId), cancellationToken);

        // Another user's session, and a missing one, read the same from here.
        if (!owned)
            throw new DefenseSessionNotFoundException();
    }
}
