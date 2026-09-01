using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Integration tests for the competitions the site hosts itself: what an entry may be taken into, what spending
/// one opens, and the gate keeping an embargoed problem from anybody who has not spent one.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class HostedCompetitionServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IHostedCompetitionService>(fixture)
{
    /// <summary>
    /// The longest comment this class's caps allow, which is what the cap test writes against.
    /// </summary>
    private const int CommentCharCap = 1000;

    /// <summary>
    /// How long the seeded groups' clocks run, which is what a test spending one has to get past.
    /// </summary>
    private const int ClockMinutes = 180;

    /// <summary>
    /// How long after an entry the service still takes notes, which is what a test closing one has to get past.
    /// </summary>
    private const int NoteGraceMinutes = 30;

    /// <summary>
    /// The student every test enters as.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// A second student, so what one of them does can be checked not to read back as the other's.
    /// </summary>
    private readonly Guid _otherStudentId = Guid.CreateVersion7();

    /// <summary>
    /// What addresses the open group's harder round, which is what every call about it is made under. English,
    /// one of the names the taxonomy gives it, since the resolver takes any of them.
    /// </summary>
    private const string AdvancedSlug = "advanced-1-2026";

    /// <summary>
    /// What addresses the open group's easier round.
    /// </summary>
    private const string ElementarySlug = "elementary-1-2026";

    /// <summary>
    /// What addresses the round of the group that has not opened yet.
    /// </summary>
    private const string UpcomingSlug = "intermediate-1-2026";

    /// <summary>
    /// What addresses the practice round.
    /// </summary>
    private const string PracticeSlug = "practice-2026";

    /// <summary>
    /// What addresses the round whose embargo has passed, which ran a season before the open group's.
    /// </summary>
    private const string OpenedSlug = "advanced-1-2025";

    /// <summary>
    /// What addresses the round its group announced more problems than it holds, which ran two seasons before
    /// the open group's.
    /// </summary>
    private const string UnfilledSlug = "elementary-1-2024";

    /// <summary>
    /// The round of the open group's harder category, which is what the rows are seeded and read back under.
    /// </summary>
    private readonly Guid _advancedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round of the open group's easier category, so entering two categories at once can be tried.
    /// </summary>
    private readonly Guid _elementaryRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round of the group that has not opened yet.
    /// </summary>
    private readonly Guid _upcomingRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round of the practice group, which never closes and may be taken again.
    /// </summary>
    private readonly Guid _practiceRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The round whose embargo has already passed, so its problems are public.
    /// </summary>
    private readonly Guid _openedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// A group declared before any of its rounds were, so it runs nothing.
    /// </summary>
    private readonly Guid _emptyGroupId = Guid.CreateVersion7();

    /// <summary>
    /// The round of an open group whose problems have not all landed, holding one where its group announces two.
    /// </summary>
    private readonly Guid _unfilledRoundId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The registry the group's name is read out of.
        services.AddLocalization();

        // The caps a problem's conversation rows report.
        services.Configure<DefenseLimits>(limits =>
        {
            limits.MaxCandidateChars = 4000;
            limits.MaxHandoutContentIdChars = 100;
            limits.MaxEnvironmentIdChars = 100;
            limits.MaxFeedbackCommentChars = CommentCharCap;
            limits.MaxMessagesPerDefense = 20;
            limits.DailySpendCeilingPerUser = 1;
        });

        // The window a note about a solution stays open in, past the end of the entry.
        services.Configure<HostedCompetitionOptions>(
            options => options.NoteGraceMinutes = NoteGraceMinutes);

        // The service under test.
        services.AddScoped<IHostedCompetitionService, HostedCompetitionService>();
    }

    /// <summary>
    /// Verifies that entering opens the problems and starts a clock, and that both come back in one answer.
    /// </summary>
    [Fact]
    public Task Entering_starts_a_clock_and_opens_the_problems() => RunTestAsync(async service =>
    {
        // Take the entry
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // A sat entry, the kind that carries a clock
        var entry = Assert.IsType<SatEntryDto>(spent.Entry);

        // And which nobody has closed
        Assert.Null(entry.FinishedAt);

        // The set it bought, in the order the competition sets it
        Assert.Equal([1, 2], spent.Problems.Select(problem => problem.Position));

        // The first statement, carrying every language the site is read in
        Assert.Equal(
            Enum.GetValues<Language>().Order(),
            spent.Problems[0].Statement.Keys.Order());

        // The Slovak text of that statement
        Assert.Equal("Zadanie 1", spent.Problems[0].Statement[Language.SK]);

        // And the English text of the same one
        Assert.Equal("Statement 1", spent.Problems[0].Statement[Language.EN]);
    });

    /// <summary>
    /// Verifies that giving the entry up opens the same problems and starts no clock.
    /// </summary>
    [Fact]
    public Task Forfeiting_opens_the_problems_without_a_clock() => RunTestAsync(async service =>
    {
        // Give the entry up
        var spent = await service.ForfeitAsync(_studentId, AdvancedSlug);

        // Which is its own kind of entry, with no clock to read
        Assert.IsType<ForfeitedEntryDto>(spent.Entry);

        // And it buys the same set a sat entry does
        Assert.Equal(2, spent.Problems.Count);
    });

    /// <summary>
    /// Verifies that a group not yet taking entries refuses one.
    /// </summary>
    [Fact]
    public Task An_upcoming_group_refuses_an_entry() => RunTestAsync(async service =>
        // Announced, and not open yet
        await Assert.ThrowsAsync<HostedGroupNotOpenException>(
            () => service.EnterAsync(_studentId, UpcomingSlug)));

    /// <summary>
    /// Verifies that a group past its window refuses an entry. Its problems are already public by then, so an
    /// entry taken after the fact would be a clock started against a set the student could simply read.
    /// </summary>
    [Fact]
    public Task A_closed_group_refuses_an_entry() => RunTestAsync(async service =>
        // Over, and not taking entries any more
        await Assert.ThrowsAsync<HostedGroupNotOpenException>(
            () => service.EnterAsync(_studentId, OpenedSlug)));

    /// <summary>
    /// Verifies that a competition short of the problems its group announced refuses an entry. A group goes on
    /// the site before its problems are picked, so a window can open over a round that is still being filled, and
    /// an entry is spent once: buying a paper the card promised and the round cannot serve costs the student the
    /// whole competition.
    /// </summary>
    [Fact]
    public Task A_competition_short_of_its_problems_refuses_an_entry() => RunTestAsync(async service =>
    {
        // Open, and holding one problem where its group announced two
        await Assert.ThrowsAsync<HostedCompetitionNotReadyException>(
            () => service.EnterAsync(_studentId, UnfilledSlug));

        // Nor was an entry left behind by the attempt
        Assert.Equal(0, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that a forfeit into a competition short of its problems is refused the same as a sitting. Giving
    /// an entry up buys the problems, so it spends exactly what entering spends, and a guard that only covered
    /// the sitting half would hand the short paper over for the same price.
    /// </summary>
    [Fact]
    public Task A_competition_short_of_its_problems_refuses_a_forfeit() => RunTestAsync(async service =>
    {
        // Given up rather than sat, into the round holding one of its two problems
        await Assert.ThrowsAsync<HostedCompetitionNotReadyException>(
            () => service.ForfeitAsync(_studentId, UnfilledSlug));

        // Nor was an entry left behind by the attempt
        Assert.Equal(0, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that a student whose account is missing one of the fields the entry gate asks for cannot enter.
    /// A gate only the browser keeps is one a request that never went through the browser walks past.
    /// </summary>
    [Fact]
    public Task A_student_with_an_unfinished_profile_cannot_enter() => RunTestAsync(async service =>
    {
        // Take the graduation year off the account
        await QueryAsync(async context =>
        {
            await context.Users
                .Where(user => user.Id == _studentId)
                .ExecuteUpdateAsync(update => update.SetProperty(user => user.GraduationYear, (int?)null));
        });

        // And there is nothing to enter with
        await Assert.ThrowsAsync<HostedEntryProfileIncompleteException>(
            () => service.EnterAsync(_studentId, AdvancedSlug));

        // Nor was an entry left behind by the attempt
        Assert.Equal(0, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that a readiness read for somebody the site holds no account for refuses rather than answering
    /// for them. Callers resolve their id before asking, so an id with nothing behind it is a fault, not an
    /// answer about a student.
    /// </summary>
    [Fact]
    public Task Readiness_for_an_account_the_site_does_not_hold_is_refused() => RunTestAsync(async service =>
        // An id no seeded user carries
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetReadinessAsync(Guid.CreateVersion7())));

    /// <summary>
    /// Verifies that a student who has left school can enter. They carry no graduation year and never will, so a
    /// gate reading the year alone shuts on them with nothing left to fill in.
    /// </summary>
    [Fact]
    public Task A_student_who_has_left_school_can_enter() => RunTestAsync(async service =>
    {
        // Answer the graduation question the other way: no year, and no school left to graduate from
        await QueryAsync(async context =>
        {
            await context.Users
                .Where(user => user.Id == _studentId)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(user => user.GraduationYear, (int?)null)
                    .SetProperty(user => user.HasLeftHighSchool, true));
        });

        // The profile reads as answered
        Assert.True((await service.GetReadinessAsync(_studentId)).HasAnsweredGraduation);

        // And the entry goes through
        await service.EnterAsync(_studentId, AdvancedSlug);

        // Leaving the one entry behind
        Assert.Equal(1, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that two attempts arriving together spend one entry between them. Both read that nothing had been
    /// spent, so the rule the group states cannot refuse the second on its own: the entries are numbered and the
    /// index over them settles it.
    /// </summary>
    [Fact]
    public Task Simultaneous_entries_spend_one_between_them() => RunTestAsync(async service =>
    {
        // Two attempts at the same entry, neither waiting for the other
        var attempts = await Task.WhenAll(
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, AdvancedSlug)),
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, AdvancedSlug)));

        // One attempt took the entry
        Assert.Single(attempts, outcome => outcome is null);

        // And the other was told it was already spent
        Assert.Single(attempts.OfType<HostedEntryAlreadySpentException>());

        // Leaving the student holding exactly one
        Assert.Equal(1, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that a competition the site cannot serve refuses the request instead of consuming what was spent
    /// on it. A hosted problem is written in every language, and where one is not the read throws; doing that
    /// after the entry was written would leave the student holding one they could never spend again.
    /// </summary>
    [Fact]
    public Task A_competition_it_cannot_serve_consumes_no_entry() => RunTestAsync(async service =>
    {
        // Take one problem's English statement away
        await QueryAsync(async context =>
        {
            await context.ProblemTexts
                .Where(text => text.Problem.RoundId == _advancedRoundId
                    && text.DocumentType == DocumentType.Statement
                    && text.Language == Language.EN)
                .ExecuteDeleteAsync();
        });

        // The request cannot be answered
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.EnterAsync(_studentId, AdvancedSlug));

        // And it cost the student nothing: no entry was written
        Assert.Equal(0, await QueryValueAsync(context => context.HostedEntries.CountAsync()));

        // Nor an acceptance recorded against one
        Assert.False((await service.GetReadinessAsync(_studentId)).HasAcceptedRules);
    });

    /// <summary>
    /// Verifies that an unfinished profile stops a graded entry and not a practice one. The fields exist so a
    /// published result can name the student, and the group that never closes publishes none.
    /// </summary>
    [Fact]
    public Task An_unfinished_profile_stops_only_a_graded_entry() => RunTestAsync(async service =>
    {
        // Take back the name a result would be published under
        await QueryAsync(async context =>
        {
            await context.Users
                .Where(user => user.Id == _studentId)
                .ExecuteUpdateAsync(update => update.SetProperty(user => user.Username, (string?)null));
        });

        // The graded competition refuses them
        await Assert.ThrowsAsync<HostedEntryProfileIncompleteException>(
            () => service.EnterAsync(_studentId, AdvancedSlug));

        // While the practice one takes them
        await service.EnterAsync(_studentId, PracticeSlug);

        // Leaving the one entry behind, which is the practice run
        Assert.Equal(1, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that hiding the profile prompt is recorded once and reported back, and that asking again leaves
    /// the first answer where it is rather than restamping it.
    /// </summary>
    [Fact]
    public Task Hiding_the_profile_prompt_is_asked_once_ever() => RunTestAsync(async service =>
    {
        // Nothing hidden before they ask
        Assert.False((await service.GetReadinessAsync(_studentId)).HasHiddenProfilePrompt);

        // They ask
        await service.DismissProfilePromptAsync(_studentId);

        // When they asked
        var dismissedAt = await QueryValueAsync(context => context.Users
            .Where(user => user.Id == _studentId)
            .Select(user => user.ProfilePromptDismissedAt)
            .FirstAsync());

        // Which the readiness now reports
        Assert.True((await service.GetReadinessAsync(_studentId)).HasHiddenProfilePrompt);

        // Asking a second time
        await service.DismissProfilePromptAsync(_studentId);

        // Leaves the first answer standing, since it is when they asked and not how often
        Assert.Equal(
            dismissedAt,
            await QueryValueAsync(context => context.Users
                .Where(user => user.Id == _studentId)
                .Select(user => user.ProfilePromptDismissedAt)
                .FirstAsync()));
    });

    /// <summary>
    /// Verifies that a student taking the practice group again ends up on one run rather than two. The row is
    /// reset rather than added to, and the index over the pair is what makes that hold when the two attempts
    /// arrive together and neither has seen the other's write.
    /// </summary>
    [Fact]
    public Task Simultaneous_practice_entries_settle_on_one_run() => RunTestAsync(async service =>
    {
        // Two attempts at the practice group, neither waiting for the other
        await Task.WhenAll(
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, PracticeSlug)),
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, PracticeSlug)));

        // Leaving the student on exactly one run of it
        Assert.Equal(1, await QueryValueAsync(context => context.HostedEntries.CountAsync()));
    });

    /// <summary>
    /// Verifies that an entry is spent once, whichever way the student spent it.
    /// </summary>
    [Fact]
    public Task A_second_entry_into_the_same_competition_is_refused() => RunTestAsync(async service =>
    {
        // Spend it
        await service.EnterAsync(_studentId, AdvancedSlug);

        // And there is nothing left to spend, even on the other way of spending it
        await Assert.ThrowsAsync<HostedEntryAlreadySpentException>(
            () => service.ForfeitAsync(_studentId, AdvancedSlug));
    });

    /// <summary>
    /// Verifies that the practice group may be taken again, which is what its re-entry flag is for.
    /// </summary>
    [Fact]
    public Task The_practice_group_may_be_entered_again() => RunTestAsync(async service =>
    {
        // Sit it once
        await service.EnterAsync(_studentId, PracticeSlug);

        // And again, which anywhere else would be refused
        var second = await service.EnterAsync(_studentId, PracticeSlug);

        // On the one row a student ever holds here, which the second run reset rather than added to
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.HostedEntries
                .CountAsync(entry => entry.RoundId == _practiceRoundId)));

        // What the student can see
        var view = await service.GetViewAsync(_studentId);

        // The practice competition sitting in it
        var practice = CompetitionIn(view, PracticeSlug);

        // Which reads the run they are on
        Assert.Equal(
            ((SatEntryDto)second.Entry).StartedAt,
            Assert.IsType<SatEntryDto>(practice.Entry).StartedAt);
    });

    /// <summary>
    /// Verifies that handing in closes the entry the student is currently on. Where re-entry is allowed they hold
    /// several, and closing any but the latest would leave the clock they are actually running still going while
    /// the page shows them as done.
    /// </summary>
    [Fact]
    public Task Handing_in_closes_the_latest_entry() => RunTestAsync(async service =>
    {
        // An entry into the group that allows a second
        await service.EnterAsync(_studentId, PracticeSlug);

        // And that second one, which is the run they end up on
        var second = await service.EnterAsync(_studentId, PracticeSlug);

        // Hand in
        await service.FinishAsync(_studentId, PracticeSlug);

        // The only entry carrying a hand-in stamp
        var closed = await QueryValueAsync(context => context.HostedEntries
            .Where(entry => entry.RoundId == _practiceRoundId && entry.FinishedAt != null)
            .Select(entry => entry.StartedAt)
            .SingleAsync());

        // Which is the one they were on
        Assert.Equal(((SatEntryDto)second.Entry).StartedAt, closed);
    });

    /// <summary>
    /// Verifies that a group with no rounds yet reads as an empty one rather than taking the page down with it. A
    /// group is declared before its rounds are, and the view is what every visitor lands on.
    /// </summary>
    [Fact]
    public Task A_group_with_no_rounds_reads_as_empty() => RunTestAsync(async service =>
    {
        // The group nothing runs under yet
        var group = Assert.Single(
            (await service.GetViewAsync(_studentId)).Groups,
            candidate => candidate.Id == _emptyGroupId);

        // It still says how many problems it will set, that being its own and not its rounds'
        Assert.Equal(2, group.ProblemCount);

        // No competitions run under it
        Assert.Empty(group.Competitions);

        // And its name is empty in every language, there being no round to read one off
        Assert.All(group.Name.Values, name => Assert.Equal(string.Empty, name));
    });

    /// <summary>
    /// Verifies that taking the practice group again clears what the run before it left on the row. A student
    /// who handed in and started over is sitting a fresh clock, and a stamp left standing from the old run
    /// would read as a run already over.
    /// </summary>
    [Fact]
    public Task Taking_the_practice_group_again_clears_the_run_before_it() => RunTestAsync(async service =>
    {
        // Sit it
        await service.EnterAsync(_studentId, PracticeSlug);

        // And hand it in
        await service.FinishAsync(_studentId, PracticeSlug);

        // Then start over
        var again = await service.EnterAsync(_studentId, PracticeSlug);

        // Which is a clock running, not the one that was handed in
        Assert.Null(Assert.IsType<SatEntryDto>(again.Entry).FinishedAt);

        // And handing in is something they can do again, which a stale stamp would refuse
        await service.FinishAsync(_studentId, PracticeSlug);
    });

    /// <summary>
    /// Verifies that giving up an entry and then taking the group again leaves a clock running rather than the
    /// entry they gave up, the two being exclusive on the row they now share.
    /// </summary>
    [Fact]
    public Task Sitting_the_practice_group_after_giving_it_up_starts_a_clock() => RunTestAsync(async service =>
    {
        // Give it up
        await service.ForfeitAsync(_studentId, PracticeSlug);

        // Then sit it
        var sat = await service.EnterAsync(_studentId, PracticeSlug);

        // Which is a clock running
        Assert.IsType<SatEntryDto>(sat.Entry);

        // And nothing of the entry given up is left on the row beside it
        Assert.Null(await QueryValueAsync(context => context.HostedEntries
            .Where(entry => entry.RoundId == _practiceRoundId)
            .Select(entry => entry.ForfeitedAt)
            .SingleAsync()));
    });

    /// <summary>
    /// Verifies that the categories of one group are entered independently, which is deliberate: a student may
    /// sit as many levels of a month as they like.
    /// </summary>
    [Fact]
    public Task Two_categories_of_one_group_may_both_be_entered() => RunTestAsync(async service =>
    {
        // One level
        await service.EnterAsync(_studentId, AdvancedSlug);

        // And the other, which nothing about the first stands in the way of
        await service.EnterAsync(_studentId, ElementarySlug);

        // Both entries stand
        Assert.Equal(
            2,
            await QueryValueAsync(context => context.HostedEntries
                .CountAsync(entry => entry.UserId == _studentId)));
    });

    /// <summary>
    /// Verifies the gate the whole embargo rests on: an embargoed competition's problems reach nobody who has
    /// not spent an entry into it.
    /// </summary>
    [Fact]
    public Task An_embargoed_competitions_problems_are_refused_without_an_entry() => RunTestAsync(
        async service =>
            // Nothing spent, nothing to read
            await Assert.ThrowsAsync<HostedEntryRequiredException>(
                () => service.GetProblemsAsync(_studentId, AdvancedSlug)));

    /// <summary>
    /// Verifies that an entry given up for the problems opens them as fully as one that was sat. The whole point
    /// of forfeiting is reading them, so a gate that only let a sat entry through would make it pointless.
    /// </summary>
    [Fact]
    public Task A_forfeited_entry_opens_the_problems() => RunTestAsync(async service =>
    {
        // Give the entry up
        await service.ForfeitAsync(_studentId, AdvancedSlug);

        // And the problems read back like any other
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which is the whole set
        Assert.Equal(2, problems.Count);
    });

    /// <summary>
    /// Verifies that once the embargo has passed the problems are public, so no entry is asked for. This is what
    /// makes the gate a comparison against the clock rather than a check for an entry that never expires.
    /// </summary>
    [Fact]
    public Task An_opened_competitions_problems_need_no_entry() => RunTestAsync(async service =>
    {
        // Nobody has entered this one, and its problems open anyway
        var problems = await service.GetProblemsAsync(_studentId, OpenedSlug);

        // Which is the whole set
        Assert.Single(problems);
    });

    /// <summary>
    /// Verifies that a student with a clock running is handed no official solution, on the answer the entry itself
    /// comes back in and on every read after it.
    /// </summary>
    [Fact]
    public Task A_running_clock_hands_back_no_solution() => RunTestAsync(async service =>
    {
        // Take the entry, which starts the clock
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The answer it came back in carries the statements and nothing to check them against
        Assert.All(spent.Problems, problem => Assert.Null(problem.Solution));

        // Read the set again while the clock is still running
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which holds nothing to check the statements against either
        Assert.All(problems, problem => Assert.Null(problem.Solution));
    });

    /// <summary>
    /// Verifies that handing the entry in opens the solutions, in every language the site is read in.
    /// </summary>
    [Fact]
    public Task Handing_the_entry_in_opens_the_solutions() => RunTestAsync(async service =>
    {
        // Sit the entry
        await service.EnterAsync(_studentId, AdvancedSlug);

        // And close it
        await service.FinishAsync(_studentId, AdvancedSlug);

        // Read the set back
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which now carries what the problems were measured against
        var solution = Assert.IsAssignableFrom<IReadOnlyDictionary<Language, string>>(problems[0].Solution);

        // Written in every language the site is read in, the way the statement beside it is
        Assert.Equal(Enum.GetValues<Language>().Order(), solution.Keys.Order());

        // And it is the first problem's own solution
        Assert.Equal("Riešenie 1", solution[Language.SK]);
        Assert.Equal("Solution 1", solution[Language.EN]);
    });

    /// <summary>
    /// Verifies that giving the entry up opens the solutions with the problems. Whoever forfeits has said they are
    /// not competing here, which is the whole of what holds a solution back.
    /// </summary>
    [Fact]
    public Task Forfeiting_opens_the_solutions() => RunTestAsync(async service =>
    {
        // Give the entry up, which starts no clock
        var spent = await service.ForfeitAsync(_studentId, AdvancedSlug);

        // So the answer carries the solutions along with the statements
        Assert.All(spent.Problems, problem => Assert.NotNull(problem.Solution));
    });

    /// <summary>
    /// Verifies that a competition past its embargo hands its solutions to a reader holding no entry, the same way
    /// it hands them its problems.
    /// </summary>
    [Fact]
    public Task An_opened_competitions_solutions_need_no_entry() => RunTestAsync(async service =>
    {
        // Nobody has entered this one, and its solutions open anyway
        var problems = await service.GetProblemsAsync(_studentId, OpenedSlug);

        // And there is no run of theirs a solution could spoil
        Assert.NotNull(problems[0].Solution);
    });

    /// <summary>
    /// Verifies that a clock still running holds the solutions back on a round whose problems are already public,
    /// which the practice one here is. The embargo and the student's own clock are separate gates, and a lifted
    /// embargo says nothing about whether somebody is mid-run.
    /// </summary>
    [Fact]
    public Task A_running_practice_clock_beats_the_public_problems() => RunTestAsync(async service =>
    {
        // Read the round before anything is entered
        var beforehand = await service.GetProblemsAsync(_studentId, PracticeSlug);

        // Its problems are open to anybody, solution and all
        Assert.NotNull(beforehand[0].Solution);

        // Then sit the practice run, which starts a clock over that same public set
        var spent = await service.EnterAsync(_studentId, PracticeSlug);

        // And the solution goes away in the answer the entry came back in
        Assert.Null(spent.Problems[0].Solution);

        // As it does on every read while that clock runs
        Assert.Null((await service.GetProblemsAsync(_studentId, PracticeSlug))[0].Solution);
    });

    /// <summary>
    /// Verifies that taking a re-entrant group again closes the solutions the run before it opened. The row in the
    /// database still holds the finished run at the moment the set is read, so only the stamps the new entry has
    /// just been given can say the student is competing again.
    /// </summary>
    [Fact]
    public Task Taking_the_practice_group_again_closes_its_solutions() => RunTestAsync(async service =>
    {
        // Sit a run
        await service.EnterAsync(_studentId, PracticeSlug);

        // And close it, which opens the solutions
        await service.FinishAsync(_studentId, PracticeSlug);

        // And the set reads that solution back
        Assert.NotNull((await service.GetProblemsAsync(_studentId, PracticeSlug))[0].Solution);

        // Then a second go at the same competition, which starts a fresh clock over the same problems
        var again = await service.EnterAsync(_studentId, PracticeSlug);

        // The set it hands back holds nothing to measure them against
        Assert.All(again.Problems, problem => Assert.Null(problem.Solution));

        // And neither does reading it again
        Assert.All(
            await service.GetProblemsAsync(_studentId, PracticeSlug),
            problem => Assert.Null(problem.Solution));
    });

    /// <summary>
    /// Verifies that a problem whose solution was never written in one of the site's languages stops the read
    /// rather than serving a set with a hole in it. The declaration refuses a round like that, so one reaching a
    /// reader is a bug upstream, and a read that quietly went on would be the thing hiding it.
    /// </summary>
    [Fact]
    public Task A_solution_missing_a_language_stops_the_read() => RunTestAsync(async service =>
    {
        // The English solution of every problem in an open competition, taken away
        await QueryAsync(context => context.ProblemTexts
            .Where(text => text.Problem.RoundId == _openedRoundId
                && text.DocumentType == DocumentType.Solution
                && text.Language == Language.EN)
            .ExecuteDeleteAsync());

        // Which the read refuses to work around
        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.GetProblemsAsync(_studentId, OpenedSlug));

        // Naming what the round is missing
        Assert.Contains("solution", thrown.Message, StringComparison.OrdinalIgnoreCase);
    });

    /// <summary>
    /// Verifies that a slug addressing no hosted round answers as no competition at all, rather than leaking
    /// which part of it was wrong.
    /// </summary>
    /// <param name="competitionSlug">What the caller addressed the competition by.</param>
    [Theory]
    [InlineData("advanced-1")]
    [InlineData("advanced-1-x")]
    [InlineData("nothing-is-called-this-2026")]
    [InlineData("advanced-1-1999")]
    public Task A_slug_addressing_no_hosted_round_is_no_competition(string competitionSlug) =>
        RunTestAsync(async service =>
            // Shaped wrong, naming a node nothing carries, or naming a season the site ran nothing in
            await Assert.ThrowsAsync<HostedCompetitionNotFoundException>(
                () => service.GetProblemsAsync(_studentId, competitionSlug)));

    /// <summary>
    /// Verifies that handing in closes a running entry, and that only a running one can be handed in.
    /// </summary>
    [Fact]
    public Task Only_a_running_entry_can_be_handed_in() => RunTestAsync(async service =>
    {
        // Nothing taken yet, so there is nothing to close
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, AdvancedSlug));

        // Take it
        await service.EnterAsync(_studentId, AdvancedSlug);

        // Then close it
        var finished = await service.FinishAsync(_studentId, AdvancedSlug);

        // Which stamps it
        Assert.NotNull(Assert.IsType<SatEntryDto>(finished).FinishedAt);

        // And a closed entry cannot close twice
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, AdvancedSlug));
    });

    /// <summary>
    /// Verifies that an entry given up has no hand-in: it was over the moment it was spent.
    /// </summary>
    [Fact]
    public Task A_forfeited_entry_cannot_be_handed_in() => RunTestAsync(async service =>
    {
        // Give it up
        await service.ForfeitAsync(_studentId, AdvancedSlug);

        // There is no clock on it to stop
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, AdvancedSlug));
    });

    /// <summary>
    /// Verifies that spending a first entry accepts the rules, and that a later one leaves the original
    /// acceptance where it is.
    /// </summary>
    [Fact]
    public Task The_first_entry_accepts_the_rules() => RunTestAsync(async service =>
    {
        // Nothing accepted before the first entry
        Assert.False((await service.GetReadinessAsync(_studentId)).HasAcceptedRules);

        // The entry that carries the acceptance
        await service.EnterAsync(_studentId, AdvancedSlug);

        // When they accepted
        var acceptedAt = await QueryValueAsync(context => context.Users
            .Where(user => user.Id == _studentId)
            .Select(user => user.RulesAcceptedAt)
            .FirstAsync());

        // Which the readiness now reports
        Assert.True((await service.GetReadinessAsync(_studentId)).HasAcceptedRules);

        // A second entry, into the other level
        await service.EnterAsync(_studentId, ElementarySlug);

        // Which leaves the first acceptance standing, an acceptance being given once ever
        Assert.Equal(
            acceptedAt,
            await QueryValueAsync(context => context.Users
                .Where(user => user.Id == _studentId)
                .Select(user => user.RulesAcceptedAt)
                .FirstAsync()));
    });

    /// <summary>
    /// Verifies what the view says about a competition before anybody enters it: which level it runs at, and
    /// whether its problems are out.
    /// </summary>
    [Fact]
    public Task The_view_reads_the_category_and_the_embargo_off_the_round() => RunTestAsync(async service =>
    {
        // What the student can see
        var view = await service.GetViewAsync(_studentId);

        // The level comes from the node the round hangs off
        Assert.Equal(HostedCompetitionCategory.Advanced, CompetitionIn(view, AdvancedSlug).Category);

        // And the practice one hangs outside the levels entirely
        Assert.Null(CompetitionIn(view, PracticeSlug).Category);

        // An embargoed competition's problems are not out
        Assert.False(CompetitionIn(view, AdvancedSlug).ProblemsPublished);

        // And one whose instant has passed has them out for everybody
        Assert.True(CompetitionIn(view, OpenedSlug).ProblemsPublished);

        // Nothing has been entered, so nothing carries an entry
        Assert.Null(CompetitionIn(view, AdvancedSlug).Entry);
    });

    /// <summary>
    /// Verifies that the view reads only the reader's own entries. A student shown somebody else's would be told
    /// they had already entered a competition they have not, and the entry they still hold would be unreachable.
    /// </summary>
    [Fact]
    public Task Another_students_entry_is_not_read_as_this_students() => RunTestAsync(async service =>
    {
        // Somebody else takes the entry
        await service.EnterAsync(_otherStudentId, AdvancedSlug);

        // And this student, who has spent nothing, is holding nothing
        Assert.Null(CompetitionIn(await service.GetViewAsync(_studentId), AdvancedSlug).Entry);
    });

    /// <summary>
    /// Verifies that a problem carries only the reader's own conversations. The rows say when each was opened and
    /// how much room is left in it, so somebody else's would both mislead the reader about their own history and
    /// hand them the id of a conversation that is not theirs.
    /// </summary>
    [Fact]
    public Task Another_students_conversations_do_not_appear_on_the_problems() => RunTestAsync(async service =>
    {
        // The other student argues the first problem of the set
        await QueryAsync(async context =>
        {
            // Whichever problem the seed placed first.
            var problemId = await context.Problems
                .Where(problem => problem.RoundId == _advancedRoundId && problem.Number == 1)
                .Select(problem => problem.Id)
                .FirstAsync();

            // Their conversation about it, with one turn so it has an instant to be ordered by.
            SeedDefense(context, _otherStudentId, problemId);

            // Submit changes
            await context.SaveChangesAsync();
        });

        // This student spends their own entry to reach the same set
        await service.ForfeitAsync(_studentId, AdvancedSlug);

        // The set that entry opens
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Where nothing anybody else said is theirs to see
        Assert.All(problems, problem => Assert.Empty(problem.Defenses));
    });

    /// <summary>
    /// Verifies that a signed-out visitor reads the groups and nobody's history.
    /// </summary>
    [Fact]
    public Task A_signed_out_visitor_reads_the_groups_and_no_entries() => RunTestAsync(async service =>
    {
        // A student takes an entry
        await service.EnterAsync(_studentId, AdvancedSlug);

        // What somebody with no account sees
        var view = await service.GetViewAsync(userId: null);

        // The same competitions
        Assert.Equal(HostedCompetitionCategory.Advanced, CompetitionIn(view, AdvancedSlug).Category);

        // And none of anybody's entries
        Assert.Null(CompetitionIn(view, AdvancedSlug).Entry);
    });

    /// <summary>
    /// Verifies that a group's heading comes off its rounds, which share it by construction, while the size it
    /// announces is its own. Read off the group whose round is still a problem short, since that is the only one
    /// where the two answers differ: counting the round would say one, and the card has to keep saying two from
    /// the day the dates were set.
    /// </summary>
    [Fact]
    public Task A_group_reads_its_name_off_its_rounds_and_its_size_off_itself() => RunTestAsync(async service =>
    {
        // Every group on the page
        var groups = (await service.GetViewAsync(_studentId)).Groups;

        // The one whose round holds one problem against the two it announced
        var unfilled = Assert.Single(
            groups,
            candidate => candidate.Competitions.Any(
                competition => competition.Slug.Values.Contains(UnfilledSlug)));

        // Which still says two, the number it was declared with rather than the one its round holds
        Assert.Equal(2, unfilled.ProblemCount);

        // The group the two categories run in
        var group = Assert.Single(
            groups,
            candidate => candidate.Competitions.Any(
                competition => competition.Slug.Values.Contains(AdvancedSlug)));

        // The size it was declared with
        Assert.Equal(2, group.ProblemCount);

        // And the heading carries every language the site is read in
        Assert.Equal(Enum.GetValues<Language>().Order(), group.Name.Keys.Order());

        // Each one carrying the localized name of the node its rounds hang off
        Assert.All(group.Name.Values, name => Assert.False(string.IsNullOrWhiteSpace(name)));
    });

    /// <summary>
    /// Verifies that what a student says about their own solution reads back on the problem it was about, and
    /// that saying it again revises the one claim rather than standing beside the first.
    /// </summary>
    [Fact]
    public Task A_claim_about_a_solution_reads_back_and_is_revised_in_place() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim is made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem it is made about
        var problemId = spent.Problems[0].Id;

        // What the student first says
        await service.SetSelfAssessmentAsync(
            _studentId, AdvancedSlug, problemId, "stuck on the last case");

        // And what they say once they have finished it
        await service.SetSelfAssessmentAsync(
            _studentId, AdvancedSlug, problemId, "the last case works after all");

        // The set as it now reads
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which carries only what they currently say
        Assert.Equal(
            "the last case works after all",
            Assert.Single(problems, problem => problem.Id == problemId).SelfAssessment);

        // On the one row a student ever holds about a problem
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.ProblemSelfAssessments
                .CountAsync(assessment => assessment.ProblemId == problemId)));

        // And the rest of the set untouched
        Assert.All(
            problems.Where(problem => problem.Id != problemId),
            problem => Assert.Null(problem.SelfAssessment));
    });

    /// <summary>
    /// Verifies that revising a claim leaves it still saying when the student first made it. The two stamps are
    /// what tells a claim nobody has touched from one that has moved since, so a revision must keep the first.
    /// </summary>
    [Fact]
    public Task A_revised_claim_still_says_when_it_was_first_made() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim is made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem it is made about
        var problemId = spent.Problems[0].Id;

        // What the student first says
        await service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, problemId, "half of it");

        // The row it left
        var first = await ReadClaimAsync(problemId);

        // Which nothing has moved yet, so both its stamps read the same
        Assert.Equal(first.CreatedAt, first.UpdatedAt);

        // And what they say once they have finished it
        await service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, problemId, "all of it");

        // The row as it now stands
        var revised = await ReadClaimAsync(problemId);

        // Still saying when they first spoke
        Assert.Equal(first.CreatedAt, revised.CreatedAt);

        // And saying separately when they last changed it
        Assert.True(revised.UpdatedAt > first.UpdatedAt);
    });

    /// <summary>
    /// Verifies that a student can take a claim back, and that taking back one they never made leaves them where
    /// they asked to be rather than failing.
    /// </summary>
    [Fact]
    public Task A_claim_can_be_taken_back_and_taking_back_nothing_passes() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim is made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem it is made about
        var problemId = spent.Problems[0].Id;

        // Nothing stands yet, and dropping nothing is not a failure
        await service.ClearSelfAssessmentAsync(_studentId, AdvancedSlug, problemId);

        // Something the student then says
        await service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, problemId, "no idea on this one");

        // And takes back
        await service.ClearSelfAssessmentAsync(_studentId, AdvancedSlug, problemId);

        // The set as it now reads
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Leaving the problem carrying nothing of theirs
        Assert.Null(Assert.Single(problems, problem => problem.Id == problemId).SelfAssessment);
    });

    /// <summary>
    /// Verifies that a note outlives the entry by the grace that follows it, so a student who ran out of clock
    /// mid-thought still gets to write it down.
    /// </summary>
    [Fact]
    public Task A_note_survives_the_entry_by_its_grace() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim is made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem it is made about
        var problemId = spent.Problems[0].Id;

        // Closed where the student says
        await service.FinishAsync(_studentId, AdvancedSlug);

        // Which still takes what they have to say about it
        await service.SetSelfAssessmentAsync(
            _studentId, AdvancedSlug, problemId, "one more thought on the way out");

        // The set as it now reads
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Carrying what they said on the way out
        Assert.Equal(
            "one more thought on the way out",
            Assert.Single(problems, problem => problem.Id == problemId).SelfAssessment);
    });

    /// <summary>
    /// Verifies that a note closes once the grace after the entry has itself run out, whether the student
    /// closed the entry themselves or its clock did.
    /// </summary>
    [Fact]
    public Task A_note_closes_once_the_grace_has_run_out() => RunTestAsync(async service =>
    {
        // An entry into the harder category
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem the claim would be about
        var problemId = spent.Problems[0].Id;

        // Handed in
        await service.FinishAsync(_studentId, AdvancedSlug);

        // Long enough ago that even the grace is spent
        await BackdateEntryAsync(_advancedRoundId, ClockMinutes + NoteGraceMinutes + 1);

        // Which leaves nothing more to say about it
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, problemId, "too late"));

        // Nor anything to take back
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.ClearSelfAssessmentAsync(_studentId, AdvancedSlug, problemId));

        // A second entry, into the easier category, left open rather than handed in
        var other = await service.EnterAsync(_studentId, ElementarySlug);

        // Started far enough back that its own clock and the grace after it have both run out
        await BackdateEntryAsync(_elementaryRoundId, ClockMinutes + NoteGraceMinutes + 1);

        // Which closes it just as firmly
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, ElementarySlug, other.Problems[0].Id, "written long after the buzzer"));
    });

    /// <summary>
    /// Verifies that the grace runs from where the student stopped rather than from where their clock would
    /// have. An entry handed in with hours still on it is over the moment they hand it in, so what they may
    /// still say about it ends shortly after that, not shortly after a clock nobody let run out.
    /// </summary>
    [Fact]
    public Task The_grace_after_an_early_hand_in_runs_from_the_hand_in() => RunTestAsync(async service =>
    {
        // An entry
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem the claim would be about
        var problemId = spent.Problems[0].Id;

        // Closed at once, so nearly the whole clock is left standing on it
        await service.FinishAsync(_studentId, AdvancedSlug);

        // Moved back just past the grace, and nowhere near the end of the clock it never spent
        await BackdateEntryAsync(_advancedRoundId, NoteGraceMinutes + 1);

        // Which is already too late: the entry ended where the student ended it
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, AdvancedSlug, problemId, "written well after handing in"));
    });

    /// <summary>
    /// Verifies that a hand-in landing after the clock already ran out buys back nothing. Nothing refuses a
    /// late hand-in, so the stamp it leaves sits hours past the buzzer, and taking that as the end of the
    /// entry would hand a student a fresh grace whenever they pressed it.
    /// </summary>
    [Fact]
    public Task A_hand_in_after_the_buzzer_reopens_nothing() => RunTestAsync(async service =>
    {
        // An entry, left running
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem the claim would be about
        var problemId = spent.Problems[0].Id;

        // Moved back far enough that its clock, and the grace behind it, both ran out while the student
        // was away
        await BackdateEntryAsync(_advancedRoundId, ClockMinutes + NoteGraceMinutes + 1);

        // Closed only now, which stamps the hand-in at this moment rather than at the buzzer
        await service.FinishAsync(_studentId, AdvancedSlug);

        // And leaves the window shut: an entry ends at the buzzer at the latest, whenever the student got
        // around to saying so
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, AdvancedSlug, problemId, "hours after the clock ran out"));
    });

    /// <summary>
    /// Verifies that an entry given up for the problems takes no notes, never having been a run.
    /// </summary>
    [Fact]
    public Task An_entry_given_up_for_the_problems_takes_no_notes() => RunTestAsync(async service =>
    {
        // Given up rather than sat
        var spent = await service.ForfeitAsync(_studentId, AdvancedSlug);

        // So there is nothing of theirs to say anything about
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, AdvancedSlug, spent.Problems[0].Id, "read them without sitting them"));
    });

    /// <summary>
    /// Verifies that a claim cannot be filed under a competition whose set does not hold the problem, which is
    /// what keeps one entry's claim off another competition.
    /// </summary>
    [Fact]
    public Task A_claim_about_another_competitions_problem_is_refused() => RunTestAsync(async service =>
    {
        // An entry into the harder category
        var advanced = await service.EnterAsync(_studentId, AdvancedSlug);

        // And one into the easier, so the refusal below is not about the entry
        await service.EnterAsync(_studentId, ElementarySlug);

        // The harder category's problem, claimed under the easier one
        await Assert.ThrowsAsync<HostedProblemNotFoundException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, ElementarySlug, advanced.Problems[0].Id, "filed under the wrong set"));
    });

    /// <summary>
    /// Verifies that claiming takes an entry even where the problems are already public. Reading a set out of
    /// embargo needs nothing, and saying something about a solution is still part of a run.
    /// </summary>
    [Fact]
    public Task A_claim_takes_an_entry_even_where_the_problems_are_public() => RunTestAsync(async service =>
    {
        // The set whose embargo has passed, which anybody may read
        var problems = await service.GetProblemsAsync(_studentId, OpenedSlug);

        // And which nobody may speak in without having sat it
        await Assert.ThrowsAsync<HostedEntryRequiredException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, OpenedSlug, problems[0].Id, "read it without entering"));
    });

    /// <summary>
    /// Verifies that a claim survives taking a group again, on the same terms the conversations beside it do:
    /// what the student thinks of their solution is theirs rather than the run's.
    /// </summary>
    [Fact]
    public Task A_claim_survives_re_entry() => RunTestAsync(async service =>
    {
        // The practice run, which may be taken twice
        var first = await service.EnterAsync(_studentId, PracticeSlug);

        // The problem the claim is made about
        var problemId = first.Problems[0].Id;

        // Something said in the first run
        await service.SetSelfAssessmentAsync(_studentId, PracticeSlug, problemId, "half of it");

        // And the second run, which resets the entry row
        var second = await service.EnterAsync(_studentId, PracticeSlug);

        // Still carrying what they said, the set coming back with the entry that bought it
        Assert.Equal(
            "half of it",
            Assert.Single(second.Problems, problem => problem.Id == problemId).SelfAssessment);
    });

    /// <summary>
    /// Verifies that one student's claim is not read back as another's, the set being read per student.
    /// </summary>
    [Fact]
    public Task Another_students_claim_is_not_read_back_as_yours() => RunTestAsync(async service =>
    {
        // This student sitting the competition
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // And the other one sitting it too
        await service.EnterAsync(_otherStudentId, AdvancedSlug);

        // The problem both of them hold
        var problemId = spent.Problems[0].Id;

        // What the other one says about it
        await service.SetSelfAssessmentAsync(_otherStudentId, AdvancedSlug, problemId, "I have it");

        // The set as this student reads it
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which carries nothing of the other one's
        Assert.All(problems, problem => Assert.Null(problem.SelfAssessment));
    });

    /// <summary>
    /// Verifies that taking a claim back reaches only the competition it is asked about, since the row it drops
    /// is keyed on the student and the problem while the route names a competition.
    /// </summary>
    [Fact]
    public Task Taking_a_claim_back_reaches_only_the_named_competition() => RunTestAsync(async service =>
    {
        // An entry into the harder category
        var advanced = await service.EnterAsync(_studentId, AdvancedSlug);

        // And one into the easier
        var elementary = await service.EnterAsync(_studentId, ElementarySlug);

        // A claim standing on the harder one's first problem
        await service.SetSelfAssessmentAsync(
            _studentId, AdvancedSlug, advanced.Problems[0].Id, "the harder one");

        // And one on the easier one's
        await service.SetSelfAssessmentAsync(
            _studentId, ElementarySlug, elementary.Problems[0].Id, "the easier one");

        // The harder category's claim, asked to be dropped under the easier one
        await service.ClearSelfAssessmentAsync(_studentId, ElementarySlug, advanced.Problems[0].Id);

        // The harder category's set as it now reads
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Which leaves the claim standing, the competition it was made under not being the one that asked
        Assert.Equal(
            "the harder one",
            Assert.Single(problems, problem => problem.Id == advanced.Problems[0].Id).SelfAssessment);
    });

    /// <summary>
    /// Verifies that words saying nothing are refused rather than quietly dropping what already stands, the
    /// words being the whole of a claim.
    /// </summary>
    [Fact]
    public Task Words_saying_nothing_are_refused() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim would be made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // Nothing but whitespace, which carries no claim
        await Assert.ThrowsAsync<DefenseFeedbackValueException>(() =>
            service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, spent.Problems[0].Id, "   \n  "));
    });

    /// <summary>
    /// Verifies that words past the cap are refused and words at it are kept, the column itself holding text of
    /// any length so nothing below this would notice.
    /// </summary>
    [Fact]
    public Task Words_past_the_cap_are_refused_and_words_at_it_are_kept() => RunTestAsync(async service =>
    {
        // An entry, which is what a claim is made inside
        var spent = await service.EnterAsync(_studentId, AdvancedSlug);

        // The problem it is made about
        var problemId = spent.Problems[0].Id;

        // One character over what the caps allow
        await Assert.ThrowsAsync<DefenseFeedbackCommentTooLongException>(() =>
            service.SetSelfAssessmentAsync(
                _studentId, AdvancedSlug, problemId, new string('x', CommentCharCap + 1)));

        // Exactly what they allow, which is theirs to write
        var atTheCap = new string('x', CommentCharCap);

        // Written
        await service.SetSelfAssessmentAsync(_studentId, AdvancedSlug, problemId, atTheCap);

        // The set as it now reads
        var problems = await service.GetProblemsAsync(_studentId, AdvancedSlug);

        // Carrying every character of it
        Assert.Equal(
            atTheCap,
            Assert.Single(problems, problem => problem.Id == problemId).SelfAssessment);
    });

    /// <summary>
    /// Reads back the row behind the student's claim about one problem, which is where its stamps are.
    /// </summary>
    /// <param name="problemId">The problem the claim is about.</param>
    /// <returns>The claim.</returns>
    private Task<ProblemSelfAssessment> ReadClaimAsync(Guid problemId) =>
        QueryValueAsync(context => context.ProblemSelfAssessments
            .AsNoTracking()
            .SingleAsync(assessment =>
                assessment.UserId == _studentId && assessment.ProblemId == problemId));

    /// <summary>
    /// Moves a student's entry back in time, so a clock or a grace that would otherwise still be running has
    /// already run out.
    /// </summary>
    /// <param name="roundId">The competition their entry is into.</param>
    /// <param name="minutes">How far back to move both of its stamps.</param>
    /// <returns>A task that completes once the entry sits that far back.</returns>
    private Task BackdateEntryAsync(Guid roundId, int minutes) => QueryAsync(async context =>
    {
        // The one row a student ever holds in a round
        var entry = await context.HostedEntries.SingleAsync(
            candidate => candidate.UserId == _studentId && candidate.RoundId == roundId);

        // Both stamps move together, so a hand-in stays where it was relative to the clock it beat
        entry.StartedAt = entry.StartedAt?.AddMinutes(-minutes);
        entry.FinishedAt = entry.FinishedAt?.AddMinutes(-minutes);

        // Where the entry now sits
        await context.SaveChangesAsync();
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The student every entry is taken as, and the one whose own work must stay off their view.
        context.Users.AddRange(
            new User
            {
                Id = _studentId,
                ExternalId = "ext-student",
                Username = "Student",
                Email = "student@example.com",
                GraduationYear = 2027,
            },
            new User
            {
                Id = _otherStudentId,
                ExternalId = "ext-other-student",
                Username = "OtherStudent",
                Email = "other@example.com",
                GraduationYear = 2027,
            });

        // The one season every round below sits in.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off, placed high so it sorts after the archive's.
        CompetitionTreeSeed.Root(context, "mc", 100);

        // When the open group's problems come out, which is also when it stops taking entries.
        var closesAt = DateTimeOffset.UtcNow.AddYears(1);

        // The group taking entries now.
        var open = Group(
            context, "mc-open", DateTimeOffset.UtcNow.AddDays(-1), closesAt, allowsReentry: false,
            problemCount: 2);

        // Its rounds, one per level, embargoed until it closes.
        SeedRound(context, season, open, _advancedRoundId, "mc-advanced-1", closesAt, problems: 2);
        SeedRound(context, season, open, _elementaryRoundId, "mc-elementary-1", closesAt, problems: 2);

        // A group that has been announced and is not taking entries yet.
        var upcoming = Group(
            context, "mc-upcoming", DateTimeOffset.UtcNow.AddDays(30), DateTimeOffset.UtcNow.AddDays(60),
            allowsReentry: false, problemCount: 2);
        SeedRound(
            context, season, upcoming, _upcomingRoundId, "mc-intermediate-1",
            DateTimeOffset.UtcNow.AddDays(60), problems: 2);

        // The practice group: no closing instant, so no embargo either, and takeable again.
        var practice = Group(
            context, "mc-practice", DateTimeOffset.UtcNow.AddDays(-30), closesAt: null, allowsReentry: true,
            problemCount: 1);
        SeedRound(context, season, practice, _practiceRoundId, "mc-practice", visibleSince: null, problems: 1);

        // A group whose problems have already come out, so its round is open to everybody.
        var opened = Group(
            context, "mc-opened", DateTimeOffset.UtcNow.AddDays(-60), DateTimeOffset.UtcNow.AddDays(-1),
            allowsReentry: false, problemCount: 1);
        SeedRound(
            context, season, opened, _openedRoundId, "mc-advanced-1", DateTimeOffset.UtcNow.AddDays(-1),
            problems: 1, seasonYear: 2025);

        // A group open for entries whose round is still a problem short of what it announced, which is what one
        // looks like when the window opens before the authoring is finished.
        var unfilled = Group(
            context, "mc-unfilled", DateTimeOffset.UtcNow.AddDays(-1), closesAt, allowsReentry: false,
            problemCount: 2);
        SeedRound(
            context, season, unfilled, _unfilledRoundId, "mc-elementary-1", closesAt, problems: 1,
            seasonYear: 2024);

        // A group whose rounds have not been applied yet, which is what one looks like between the draft that
        // raises them and the problems that fill them.
        Group(
            context, "mc-empty", DateTimeOffset.UtcNow.AddDays(-1), closesAt, allowsReentry: false,
            problemCount: 2).Id = _emptyGroupId;

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks one hosted group.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug"><inheritdoc cref="HostedGroup.Slug" path="/summary"/></param>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <param name="allowsReentry"><inheritdoc cref="HostedGroup.AllowsReentry" path="/summary"/></param>
    /// <param name="problemCount"><inheritdoc cref="HostedGroup.ProblemCount" path="/summary"/></param>
    /// <returns>The tracked group.</returns>
    private static HostedGroup Group(
        MathCompsDbContext context, string slug, DateTimeOffset opensAt, DateTimeOffset? closesAt,
        bool allowsReentry, int problemCount)
    {
        // The group row.
        var group = new HostedGroup
        {
            Id = Guid.CreateVersion7(),
            Slug = slug,
            OpensAt = opensAt,
            ClosesAt = closesAt,
            ClockMinutes = ClockMinutes,
            AllowsReentry = allowsReentry,
            ProblemCount = problemCount,
        };
        context.HostedGroups.Add(group);

        // The tracked group.
        return group;
    }

    /// <summary>
    /// Tracks one round of a group, with the problems it holds.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="group">The group the round runs in.</param>
    /// <param name="roundId">The id the round's rows are seeded and read back under.</param>
    /// <param name="competitionPath">The node the round hangs off, which is what says its category.</param>
    /// <param name="visibleSince"><inheritdoc cref="Round.VisibleSince" path="/summary"/></param>
    /// <param name="problems">How many problems the round holds.</param>
    /// <param name="seasonYear">
    /// A season of its own, for a round sharing its node with another: one node holds one round per season.
    /// </param>
    private static void SeedRound(
        MathCompsDbContext context, Season season, HostedGroup group, Guid roundId, string competitionPath,
        DateTimeOffset? visibleSince, int problems, int? seasonYear = null)
    {
        // The season this round sits in, which is the shared one unless it needs its own.
        var roundSeason = seasonYear is null ? season : AnotherSeason(context, seasonYear.Value);

        // The round itself, under the deepest node its path names.
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = roundSeason.Id,
            Date = new DateOnly(2026, 10, 1),
            VisibleSince = visibleSince,
            HostedGroupId = group.Id,
        });

        // Its problems, each written in every language the site is read in.
        for (var number = 1; number <= problems; number += 1)
        {
            // The problem row.
            var problem = new Problem
            {
                Id = Guid.CreateVersion7(),
                RoundId = roundId,
                Number = number,
                Slug = $"{competitionPath}-{roundId:N}-{number}",
            };
            context.Problems.Add(problem);

            // Its statement and its solution in each language, so the answer can be checked for carrying all of
            // them. A hosted round holds both throughout, the declaration refusing a group whose problems do not.
            foreach (var (documentType, language, prefix) in new[]
                     {
                         (DocumentType.Statement, Language.SK, "Zadanie"),
                         (DocumentType.Statement, Language.CS, "Zadání"),
                         (DocumentType.Statement, Language.EN, "Statement"),
                         (DocumentType.Solution, Language.SK, "Riešenie"),
                         (DocumentType.Solution, Language.CS, "Řešení"),
                         (DocumentType.Solution, Language.EN, "Solution"),
                     })
            {
                context.ProblemTexts.Add(new ProblemText
                {
                    Id = Guid.NewGuid(),
                    ProblemId = problem.Id,
                    DocumentType = documentType,
                    Language = language,
                    MarkdownText = $"{prefix} {number}",
                    IsOriginal = language == Language.SK,
                    DateModified = DateTime.UtcNow,
                });
            }
        }
    }

    /// <summary>
    /// Tracks one student's conversation about one problem, with a single turn so it has an instant the rows are
    /// ordered by.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="userId">The student holding it.</param>
    /// <param name="problemId">The problem it is held against.</param>
    private static void SeedDefense(MathCompsDbContext context, Guid userId, Guid problemId)
    {
        // The session, stamped with the kind its target row is allowed to attach to.
        var session = new DefenseSession
        {
            Id = Guid.CreateVersion7(),
            UserId = userId,
            TargetKind = DefenseTargetKind.Problem,
            ProblemStatement = "Zadanie 1",
            ProblemReference = "Vzorové riešenie",
            ExaminerConfig = "{}",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        context.DefenseSessions.Add(session);

        // What it defends.
        context.ProblemDefenses.Add(new ProblemDefense
        {
            DefenseSessionId = session.Id,
            ProblemId = problemId,
        });

        // And one thing said in it.
        context.DefenseTurns.Add(new DefenseTurn
        {
            Id = Guid.CreateVersion7(),
            SessionId = session.Id,
            Role = TranscriptRole.Candidate,
            Content = "moja obhajoba",
            Sequence = 1,
            CreatedAt = DateTimeOffset.UtcNow,
        });
    }

    /// <summary>
    /// Tracks a season of its own, for a round that shares its node with another.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="startYear">The year the season starts in.</param>
    /// <returns>The tracked season.</returns>
    private static Season AnotherSeason(MathCompsDbContext context, int startYear)
    {
        // The season row.
        var season = new Season
        {
            Id = Guid.NewGuid(),
            StartYear = startYear,
            EditionNumber = Season.EditionFromStartYear(startYear),
        };
        context.Seasons.Add(season);

        // The tracked season.
        return season;
    }

    /// <summary>
    /// Finds one competition in a view, wherever its group sits.
    /// </summary>
    /// <param name="view">The view to read.</param>
    /// <param name="competitionSlug">What addresses the competition, in any of the languages it is named in.</param>
    /// <returns>The competition.</returns>
    private static HostedCompetitionDto CompetitionIn(HostedCompetitionsViewDto view, string competitionSlug) =>
        view.Groups
            .SelectMany(group => group.Competitions)
            .Single(competition => competition.Slug.Values.Contains(competitionSlug));
}
