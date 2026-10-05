using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Competitions;

/// <summary>
/// The reader a hosted competition's rules are weighed for: who they are, and whether the site lets them past
/// the gates a competition is entered through.
/// </summary>
/// <param name="UserId">The student reading, null where the reader has no account.</param>
/// <param name="BypassesGates">
/// Whether they hold <see cref="UserCapability.PrepareCompetitions"/>, which only an account can do.
/// </param>
public readonly record struct HostedReader(Guid? UserId, bool BypassesGates);

/// <summary>
/// What the rules read about one round to settle whether its problems may be reached: when it opens, when the
/// competition it runs in ends, and whether the reader spent an entry into it.
/// </summary>
/// <param name="VisibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
/// <param name="ClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
/// <param name="HoldsEntry">
/// Whether the reader has spent an entry into the round, whichever way they spent it. The rule takes this on
/// trust, so a match against the wrong round or the wrong student opens an embargoed set.
/// </param>
public readonly record struct RoundAccess(
    DateTimeOffset? VisibleSince, DateTimeOffset? ClosesAt, bool HoldsEntry);

/// <summary>
/// The rules a hosted competition holds its readers and their entries to, each stated once for everything that
/// has to ask it.
/// </summary>
public static class HostedEntryRules
{
    /// <summary>
    /// Throws unless the reader may read a round's problems: they are let past the gates, its embargo has
    /// passed, or they hold an entry they have spent into it. A reader with no account is held to competitions
    /// that are over.
    /// </summary>
    /// <param name="reader">The reader asking.</param>
    /// <param name="access">What the round says about being reached.</param>
    /// <param name="now">The instant the dates are read against.</param>
    public static void EnsureEntitled(HostedReader reader, RoundAccess access, DateTimeOffset now)
    {
        // A reader let past the gates reads the set whatever its embargo says.
        if (reader.BypassesGates)
            return;

        // Once the embargo has passed there is nothing left to hold back.
        if (access.VisibleSince is null || access.VisibleSince <= now)
        {
            // Which reaches every account, and a reader with none once the competition has ended too, one that
            // is over having nothing left to be spent on.
            if (reader.UserId is not null || (access.ClosesAt is { } ending && ending <= now))
                return;

            // One still running is not, whatever its embargo says: its problems are there to be competed for,
            // and competing takes an account.
            throw new HostedEntryRequiredException();
        }

        // Otherwise an entry is what opens them, and holding one is something only an account can do.
        if (reader.UserId is null)
            throw new HostedEntryRequiredException();

        // Nothing spent, nothing to read.
        if (!access.HoldsEntry)
            throw new HostedEntryRequiredException();
    }

    /// <summary>
    /// Whether the official solution to a round's problems may be put in front of a student: a clock of theirs
    /// still running is what holds it back.
    /// </summary>
    /// <remarks>
    /// Everything else opens it: an entry they handed in, a clock that ran out, an entry they gave up for the
    /// problems, and a competition that has closed, which anybody may then read.
    ///
    /// A reader let past the gates is held to their clock like everybody else
    /// (<see cref="UserCapability.PrepareCompetitions"/>).
    ///
    /// The round's embargo is a separate gate, deciding whether the problems may be reached at all, and
    /// <see cref="EnsureEntitled"/> has settled it by the time anything asks this.
    /// </remarks>
    /// <param name="startedAt"><inheritdoc cref="HostedEntry.StartedAt" path="/summary"/></param>
    /// <param name="finishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
    /// <param name="clockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
    /// <param name="now">The instant to read the clock against.</param>
    /// <returns>Whether the solution may be served.</returns>
    public static bool IsSolutionOpen(
        DateTimeOffset? startedAt, DateTimeOffset? finishedAt, int clockMinutes, DateTimeOffset now)
    {
        // No clock ever ran, so there is no run of theirs to hold anything back from: the entry was given up
        // for the problems.
        if (startedAt is not { } clockStartedAt)
            return true;

        // Closed by the student, whatever they left on the clock.
        if (finishedAt is not null)
            return true;

        // Otherwise the clock says it: one still running is a student still competing.
        return clockStartedAt.AddMinutes(clockMinutes) <= now;
    }

    /// <summary>
    /// When a sat entry stopped counting: the clock running out, or the student closing it ahead of that.
    /// </summary>
    /// <param name="startedAt">When the entry's clock started.</param>
    /// <param name="finishedAt"><inheritdoc cref="HostedEntry.FinishedAt" path="/summary"/></param>
    /// <param name="clockMinutes"><inheritdoc cref="HostedGroup.ClockMinutes" path="/summary"/></param>
    /// <returns>The earlier of the clock running out and the student's hand-in.</returns>
    public static DateTimeOffset EndedAt(DateTimeOffset startedAt, DateTimeOffset? finishedAt, int clockMinutes)
    {
        // Where the clock would have ended it anyway.
        var clockRunsOutAt = startedAt.AddMinutes(clockMinutes);

        // A hand-in counts only when it came first.
        return finishedAt is { } handedInAt && handedInAt < clockRunsOutAt ? handedInAt : clockRunsOutAt;
    }

    /// <summary>
    /// Whether a student's run is a test run: they already held <see cref="UserCapability.PrepareCompetitions"/>
    /// when its clock started. A grant handed over later leaves a run they sat for real as it was.
    /// </summary>
    /// <param name="preparerSince">
    /// When the student was handed <see cref="UserCapability.PrepareCompetitions"/>, null where they do not hold it.
    /// </param>
    /// <param name="startedAt">When the run's clock started.</param>
    /// <returns>Whether the run is a test run.</returns>
    public static bool IsTestRun(DateTimeOffset? preparerSince, DateTimeOffset startedAt) =>
        // Granted by the time the clock started, which an account without a grant never was
        preparerSince <= startedAt;

    /// <summary>
    /// Whether a student's run in a hosted group is one somebody grades: a group with no closing instant grades
    /// nobody, and nobody grades a test run.
    /// </summary>
    /// <param name="groupClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="isTestRun"><inheritdoc cref="IsTestRun" path="/summary"/></param>
    /// <returns>Whether the run is graded.</returns>
    public static bool IsGraded(DateTimeOffset? groupClosesAt, bool isTestRun) =>
        groupClosesAt is not null && !isTestRun;

    /// <summary>
    /// Whether a group's results are out, which they are for anybody once it has closed. A group with no closing
    /// instant grades nobody, so it has none.
    /// </summary>
    /// <param name="groupClosesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="now">The instant to read the close against.</param>
    /// <returns>Whether the results are out.</returns>
    public static bool AreResultsOut(DateTimeOffset? groupClosesAt, DateTimeOffset now) =>
        // Out from the closing instant on
        groupClosesAt is { } closesAt && closesAt <= now;
}

/// <summary>
/// Thrown when a student reaches for a competition's problems without having spent an entry into it.
/// </summary>
public sealed class HostedEntryRequiredException() : Exception("This competition has not been entered");
