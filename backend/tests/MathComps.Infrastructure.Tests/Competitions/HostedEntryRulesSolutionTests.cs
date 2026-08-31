using MathComps.Infrastructure.Services.Competitions;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Tests <see cref="HostedEntryRules.IsSolutionOpen"/>: a clock still running is the one thing holding the official
/// solution back, and every way a run can be over opens it.
/// </summary>
public class HostedEntryRulesSolutionTests
{
    /// <summary>
    /// The instant every case below is read against.
    /// </summary>
    private static readonly DateTimeOffset _now = new(2026, 9, 14, 12, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// How long the clock runs in these cases, in minutes.
    /// </summary>
    private const int ClockMinutes = 90;

    /// <summary>
    /// A student whose clock is still running is still competing, so the solution stays back.
    /// </summary>
    /// <param name="minutesIn">How far into the clock they are.</param>
    [Theory]
    // Just started, and most of the way through.
    [InlineData(0)]
    [InlineData(89)]
    public void A_running_clock_holds_the_solution_back(int minutesIn)
    {
        // Ask the rule about a student who started that many minutes ago and has not closed the entry.
        var isOpen = HostedEntryRules.IsSolutionOpen(
            _now.AddMinutes(-minutesIn), finishedAt: null, ClockMinutes, _now);

        // They are mid-run, so there is nothing to read.
        Assert.False(isOpen);
    }

    /// <summary>
    /// Handing in ends the run outright, whatever is left on the clock.
    /// </summary>
    [Fact]
    public void A_hand_in_opens_the_solution()
    {
        // Ask about a student ten minutes into a ninety-minute clock who closed the entry a moment ago.
        var isOpen = HostedEntryRules.IsSolutionOpen(
            _now.AddMinutes(-10), _now.AddMinutes(-1), ClockMinutes, _now);

        // They chose to stop, so they are no longer competing.
        Assert.True(isOpen);
    }

    /// <summary>
    /// An entry given up for the problems was never a run, so nothing is being protected.
    /// </summary>
    [Fact]
    public void A_forfeit_opens_the_solution()
    {
        // Ask about a forfeit, which carries no start, its clock never having run.
        var isOpen = HostedEntryRules.IsSolutionOpen(
            startedAt: null, finishedAt: null, ClockMinutes, _now);

        // Whoever gave the entry up has already been handed the problems.
        Assert.True(isOpen);
    }

    /// <summary>
    /// A clock that has run out ends the run, whether or not anything wrote a stamp to say so, and it ends it on
    /// the instant rather than some way past it.
    /// </summary>
    [Fact]
    public void The_solution_opens_the_instant_the_clock_runs_out()
    {
        // Ask about a clock with one second left on it.
        var aSecondLeft = HostedEntryRules.IsSolutionOpen(
            _now.AddMinutes(-ClockMinutes).AddSeconds(1), finishedAt: null, ClockMinutes, _now);

        // And about the same clock exactly spent.
        var exactlySpent = HostedEntryRules.IsSolutionOpen(
            _now.AddMinutes(-ClockMinutes), finishedAt: null, ClockMinutes, _now);

        // The boundary falls between them.
        Assert.False(aSecondLeft);
        Assert.True(exactlySpent);
    }
}
