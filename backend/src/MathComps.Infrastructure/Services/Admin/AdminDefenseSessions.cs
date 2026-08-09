using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Defense;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Admin;

/// <summary>
/// What every admin-side operation against a defense conversation has to settle before reaching into it. A
/// reviewer's reach isn't scoped to whoever held the conversation, so existence is the whole check, and it lives
/// on this side rather than beside the student-facing writes, where an unscoped check would be a way past the
/// ownership one.
/// </summary>
internal static class AdminDefenseSessions
{
    /// <summary>
    /// Throws when no conversation exists under the id.
    /// </summary>
    /// <param name="dbContext">The context the query is built against.</param>
    /// <param name="sessionId">The conversation to look for.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    public static async Task EnsureExistsAsync(
        MathCompsDbContext dbContext, Guid sessionId, CancellationToken cancellationToken)
    {
        // An id naming no conversation is nothing to work on.
        if (!await dbContext.DefenseSessions.AnyAsync(session => session.Id == sessionId, cancellationToken))
            throw new DefenseSessionNotFoundException();
    }
}
