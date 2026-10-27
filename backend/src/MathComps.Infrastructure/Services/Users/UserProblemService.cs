using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Services.Users;

/// <summary>
/// Service for managing user-problem interactions in the database.
/// </summary>
/// <param name="dbContext">The database context.</param>
public class UserProblemService(MathCompsDbContext dbContext) : IUserProblemService
{
    /// <inheritdoc />
    public async Task ToggleLikeAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default)
    {
        // Execute atomic toggle operation using a single SQL statement
        // This prevents race conditions by doing the entire operation atomically at the database level
        await dbContext.Database.ExecuteSqlInterpolatedAsync($@"
            WITH deleted AS (
                DELETE FROM problem_likes 
                WHERE user_id = {userId}
                  AND problem_id = {problemId}
                RETURNING *
            )
            INSERT INTO problem_likes (user_id, problem_id, created_at)
            SELECT {userId}, {problemId}, {DateTimeOffset.UtcNow}
            WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ", cancellationToken);
    }

    /// <inheritdoc />
    public async Task ToggleMarkAsync(Guid userId, Guid problemId, CancellationToken cancellationToken = default)
    {
        // Execute atomic toggle operation using a single SQL statement
        // This prevents race conditions by doing the entire operation atomically at the database level
        await dbContext.Database.ExecuteSqlInterpolatedAsync($@"
            WITH deleted AS (
                DELETE FROM problem_mark_statuses 
                WHERE user_id = {userId}
                  AND problem_id = {problemId}
                RETURNING *
            )
            INSERT INTO problem_mark_statuses (user_id, problem_id, created_at)
            SELECT {userId}, {problemId}, {DateTimeOffset.UtcNow}
            WHERE NOT EXISTS (SELECT 1 FROM deleted)
        ", cancellationToken);
    }
}
