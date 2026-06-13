namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// Extension methods for <see cref="DateTimeOffset"/> and <see cref="DateTime"/>.
/// </summary>
public static class DateTimeExtensions
{
    /// <summary>
    /// Truncates a <see cref="DateTimeOffset"/> to microsecond precision.
    /// PostgreSQL's <c>timestamptz</c> has microsecond precision, so this is useful
    /// for comparing values that have round-tripped through the database.
    /// </summary>
    /// <param name="dateTimeOffset">The <see cref="DateTimeOffset"/> to truncate.</param>
    /// <returns>A new <see cref="DateTimeOffset"/> truncated to microseconds.</returns>
    public static DateTimeOffset TruncateToMicroseconds(this DateTimeOffset dateTimeOffset)
    {
        // 1 tick = 100 nanoseconds, 1 microsecond = 10 ticks
        const long ticksPerMicrosecond = TimeSpan.TicksPerMillisecond / 1000;

        // Get rid of the ticks
        var truncatedTicks = dateTimeOffset.Ticks - (dateTimeOffset.Ticks % ticksPerMicrosecond);

        // Recreate the object with the truncated ticks and timezone
        return new DateTimeOffset(truncatedTicks, dateTimeOffset.Offset);
    }
}
