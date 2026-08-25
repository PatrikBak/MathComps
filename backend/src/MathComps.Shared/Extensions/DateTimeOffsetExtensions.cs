namespace MathComps.Shared.Extensions;
/// <summary>
/// Provides extension methods for <see cref="DateTimeOffset"/>.
/// </summary>
public static class DateTimeOffsetExtensions
{
    /// <summary>
    /// Drops whatever an instant carries below a whole microsecond, the resolution most stores keep a timestamp
    /// at. A value handed on at a finer resolution than it will be kept at is one no read of it gives back.
    /// </summary>
    /// <param name="instant">The instant to truncate.</param>
    /// <returns>The instant at whole microseconds.</returns>
    public static DateTimeOffset TruncateToMicroseconds(this DateTimeOffset instant) =>
        // A tick is a tenth of a microsecond, so the remainder is everything below one
        instant.AddTicks(-(instant.Ticks % TimeSpan.TicksPerMicrosecond));
}
