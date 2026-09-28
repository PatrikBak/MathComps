using MathComps.Infrastructure.Services.Competitions;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Tests <see cref="HostedEntryRules.EndedAt"/>: a sat entry stops counting at whichever comes first, the student
/// handing it in or the clock running out.
/// </summary>
public class HostedEntryRulesEndTests
{
    /// <summary>
    /// When every clock below started.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// How long the clock runs in these cases, in minutes.
    /// </summary>
    private const int ClockMinutes = 90;

    /// <summary>
    /// With no hand-in, the clock is what ends the entry.
    /// </summary>
    [Fact]
    public void An_entry_nobody_handed_in_ends_with_its_clock()
    {
        // Ask about an entry never closed by the student
        var endedAt = HostedEntryRules.EndedAt(_startedAt, finishedAt: null, ClockMinutes);

        // It ran the whole clock
        Assert.Equal(_startedAt.AddMinutes(ClockMinutes), endedAt);
    }

    /// <summary>
    /// A hand-in ahead of the clock ends the entry there, whatever was left on it.
    /// </summary>
    [Fact]
    public void An_early_hand_in_ends_the_entry()
    {
        // Ask about an entry handed in half an hour into the clock
        var endedAt = HostedEntryRules.EndedAt(_startedAt, _startedAt.AddMinutes(30), ClockMinutes);

        // It stopped at the hand-in
        Assert.Equal(_startedAt.AddMinutes(30), endedAt);
    }

    /// <summary>
    /// Closing an entry after its clock ran out changes nothing, the clock having ended it already.
    /// </summary>
    [Fact]
    public void A_hand_in_after_the_clock_leaves_the_clock_as_the_end()
    {
        // Ask about an entry closed ten minutes after its clock ran out
        var endedAt = HostedEntryRules.EndedAt(
            _startedAt, _startedAt.AddMinutes(ClockMinutes + 10), ClockMinutes);

        // The clock still says where it stopped
        Assert.Equal(_startedAt.AddMinutes(ClockMinutes), endedAt);
    }
}
