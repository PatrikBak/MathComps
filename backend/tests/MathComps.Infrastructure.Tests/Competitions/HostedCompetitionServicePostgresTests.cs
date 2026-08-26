using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MathComps.Infrastructure.Services.Competitions;
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
    /// The student every test enters as.
    /// </summary>
    private readonly Guid _studentId = Guid.CreateVersion7();

    /// <summary>
    /// A second student, so what one of them does can be checked not to read back as the other's.
    /// </summary>
    private readonly Guid _otherStudentId = Guid.CreateVersion7();

    /// <summary>
    /// The round of the open group's harder category.
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
            limits.MaxFeedbackCommentChars = 1000;
            limits.MaxTurnsPerSession = 20;
            limits.DailySpendCeilingPerUser = 1;
        });

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
        var spent = await service.EnterAsync(_studentId, _advancedRoundId);

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
        var spent = await service.ForfeitAsync(_studentId, _advancedRoundId);

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
            () => service.EnterAsync(_studentId, _upcomingRoundId)));

    /// <summary>
    /// Verifies that a group past its window refuses an entry. Its problems are already public by then, so an
    /// entry taken after the fact would be a clock started against a set the student could simply read.
    /// </summary>
    [Fact]
    public Task A_closed_group_refuses_an_entry() => RunTestAsync(async service =>
        // Over, and not taking entries any more
        await Assert.ThrowsAsync<HostedGroupNotOpenException>(
            () => service.EnterAsync(_studentId, _openedRoundId)));

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
            () => service.EnterAsync(_studentId, _advancedRoundId));

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
        await service.EnterAsync(_studentId, _advancedRoundId);

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
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, _advancedRoundId)),
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, _advancedRoundId)));

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
            () => service.EnterAsync(_studentId, _advancedRoundId));

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
            () => service.EnterAsync(_studentId, _advancedRoundId));

        // While the practice one takes them
        await service.EnterAsync(_studentId, _practiceRoundId);

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
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, _practiceRoundId)),
            Record.ExceptionAsync(() => service.EnterAsync(_studentId, _practiceRoundId)));

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
        await service.EnterAsync(_studentId, _advancedRoundId);

        // And there is nothing left to spend, even on the other way of spending it
        await Assert.ThrowsAsync<HostedEntryAlreadySpentException>(
            () => service.ForfeitAsync(_studentId, _advancedRoundId));
    });

    /// <summary>
    /// Verifies that the practice group may be taken again, which is what its re-entry flag is for.
    /// </summary>
    [Fact]
    public Task The_practice_group_may_be_entered_again() => RunTestAsync(async service =>
    {
        // Sit it once
        await service.EnterAsync(_studentId, _practiceRoundId);

        // And again, which anywhere else would be refused
        var second = await service.EnterAsync(_studentId, _practiceRoundId);

        // On the one row a student ever holds here, which the second run reset rather than added to
        Assert.Equal(
            1,
            await QueryValueAsync(context => context.HostedEntries
                .CountAsync(entry => entry.RoundId == _practiceRoundId)));

        // What the student can see
        var view = await service.GetViewAsync(_studentId);

        // The practice competition sitting in it
        var practice = CompetitionIn(view, _practiceRoundId);

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
        await service.EnterAsync(_studentId, _practiceRoundId);

        // And that second one, which is the run they end up on
        var second = await service.EnterAsync(_studentId, _practiceRoundId);

        // Hand in
        await service.FinishAsync(_studentId, _practiceRoundId);

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

        // The group sets no problems
        Assert.Equal(0, group.ProblemCount);

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
        await service.EnterAsync(_studentId, _practiceRoundId);

        // And hand it in
        await service.FinishAsync(_studentId, _practiceRoundId);

        // Then start over
        var again = await service.EnterAsync(_studentId, _practiceRoundId);

        // Which is a clock running, not the one that was handed in
        Assert.Null(Assert.IsType<SatEntryDto>(again.Entry).FinishedAt);

        // And handing in is something they can do again, which a stale stamp would refuse
        await service.FinishAsync(_studentId, _practiceRoundId);
    });

    /// <summary>
    /// Verifies that giving up an entry and then taking the group again leaves a clock running rather than the
    /// entry they gave up, the two being exclusive on the row they now share.
    /// </summary>
    [Fact]
    public Task Sitting_the_practice_group_after_giving_it_up_starts_a_clock() => RunTestAsync(async service =>
    {
        // Give it up
        await service.ForfeitAsync(_studentId, _practiceRoundId);

        // Then sit it
        var sat = await service.EnterAsync(_studentId, _practiceRoundId);

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
        await service.EnterAsync(_studentId, _advancedRoundId);

        // And the other, which nothing about the first stands in the way of
        await service.EnterAsync(_studentId, _elementaryRoundId);

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
                () => service.GetProblemsAsync(_studentId, _advancedRoundId)));

    /// <summary>
    /// Verifies that an entry given up for the problems opens them as fully as one that was sat. The whole point
    /// of forfeiting is reading them, so a gate that only let a sat entry through would make it pointless.
    /// </summary>
    [Fact]
    public Task A_forfeited_entry_opens_the_problems() => RunTestAsync(async service =>
    {
        // Give the entry up
        await service.ForfeitAsync(_studentId, _advancedRoundId);

        // And the problems read back like any other
        var problems = await service.GetProblemsAsync(_studentId, _advancedRoundId);

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
        var problems = await service.GetProblemsAsync(_studentId, _openedRoundId);

        // Which is the whole set
        Assert.Single(problems);
    });

    /// <summary>
    /// Verifies that a round the site does not host answers as no competition at all, rather than leaking whether
    /// an archive round exists under the id.
    /// </summary>
    [Fact]
    public Task A_round_the_site_does_not_host_is_no_competition() => RunTestAsync(async service =>
        // An id that names nothing hosted
        await Assert.ThrowsAsync<HostedCompetitionNotFoundException>(
            () => service.GetProblemsAsync(_studentId, Guid.CreateVersion7())));

    /// <summary>
    /// Verifies that handing in closes a running entry, and that only a running one can be handed in.
    /// </summary>
    [Fact]
    public Task Only_a_running_entry_can_be_handed_in() => RunTestAsync(async service =>
    {
        // Nothing taken yet, so there is nothing to close
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, _advancedRoundId));

        // Take it
        await service.EnterAsync(_studentId, _advancedRoundId);

        // Then close it
        var finished = await service.FinishAsync(_studentId, _advancedRoundId);

        // Which stamps it
        Assert.NotNull(Assert.IsType<SatEntryDto>(finished).FinishedAt);

        // And a closed entry cannot close twice
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, _advancedRoundId));
    });

    /// <summary>
    /// Verifies that an entry given up has no hand-in: it was over the moment it was spent.
    /// </summary>
    [Fact]
    public Task A_forfeited_entry_cannot_be_handed_in() => RunTestAsync(async service =>
    {
        // Give it up
        await service.ForfeitAsync(_studentId, _advancedRoundId);

        // There is no clock on it to stop
        await Assert.ThrowsAsync<HostedEntryNotRunningException>(
            () => service.FinishAsync(_studentId, _advancedRoundId));
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
        await service.EnterAsync(_studentId, _advancedRoundId);

        // When they accepted
        var acceptedAt = await QueryValueAsync(context => context.Users
            .Where(user => user.Id == _studentId)
            .Select(user => user.RulesAcceptedAt)
            .FirstAsync());

        // Which the readiness now reports
        Assert.True((await service.GetReadinessAsync(_studentId)).HasAcceptedRules);

        // A second entry, into the other level
        await service.EnterAsync(_studentId, _elementaryRoundId);

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
        Assert.Equal(HostedCompetitionCategory.Advanced, CompetitionIn(view, _advancedRoundId).Category);

        // And the practice one hangs outside the levels entirely
        Assert.Null(CompetitionIn(view, _practiceRoundId).Category);

        // An embargoed competition's problems are not out
        Assert.False(CompetitionIn(view, _advancedRoundId).ProblemsPublished);

        // And one whose instant has passed has them out for everybody
        Assert.True(CompetitionIn(view, _openedRoundId).ProblemsPublished);

        // Nothing has been entered, so nothing carries an entry
        Assert.Null(CompetitionIn(view, _advancedRoundId).Entry);
    });

    /// <summary>
    /// Verifies that the view reads only the reader's own entries. A student shown somebody else's would be told
    /// they had already entered a competition they have not, and the entry they still hold would be unreachable.
    /// </summary>
    [Fact]
    public Task Another_students_entry_is_not_read_as_this_students() => RunTestAsync(async service =>
    {
        // Somebody else takes the entry
        await service.EnterAsync(_otherStudentId, _advancedRoundId);

        // And this student, who has spent nothing, is holding nothing
        Assert.Null(CompetitionIn(await service.GetViewAsync(_studentId), _advancedRoundId).Entry);
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
        await service.ForfeitAsync(_studentId, _advancedRoundId);

        // The set that entry opens
        var problems = await service.GetProblemsAsync(_studentId, _advancedRoundId);

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
        await service.EnterAsync(_studentId, _advancedRoundId);

        // What somebody with no account sees
        var view = await service.GetViewAsync(userId: null);

        // The same competitions
        Assert.Equal(HostedCompetitionCategory.Advanced, CompetitionIn(view, _advancedRoundId).Category);

        // And none of anybody's entries
        Assert.Null(CompetitionIn(view, _advancedRoundId).Entry);
    });

    /// <summary>
    /// Verifies that a group's heading and problem count come off its rounds, which share both by construction.
    /// </summary>
    [Fact]
    public Task A_group_reads_its_name_and_size_off_its_rounds() => RunTestAsync(async service =>
    {
        // The group the two categories run in
        var group = Assert.Single(
            (await service.GetViewAsync(_studentId)).Groups,
            candidate => candidate.Competitions.Any(competition => competition.Id == _advancedRoundId));

        // Both rounds hold the same number of problems, which is what a group says it sets
        Assert.Equal(2, group.ProblemCount);

        // And the heading carries every language the site is read in
        Assert.Equal(Enum.GetValues<Language>().Order(), group.Name.Keys.Order());

        // Each one carrying the localized name of the node its rounds hang off
        Assert.All(group.Name.Values, name => Assert.False(string.IsNullOrWhiteSpace(name)));
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
        var open = Group(context, "mc-open", DateTimeOffset.UtcNow.AddDays(-1), closesAt, allowsReentry: false);

        // Its rounds, one per level, embargoed until it closes.
        SeedRound(context, season, open, _advancedRoundId, "mc-advanced", closesAt, problems: 2);
        SeedRound(context, season, open, _elementaryRoundId, "mc-elementary", closesAt, problems: 2);

        // A group that has been announced and is not taking entries yet.
        var upcoming = Group(
            context, "mc-upcoming", DateTimeOffset.UtcNow.AddDays(30), DateTimeOffset.UtcNow.AddDays(60),
            allowsReentry: false);
        SeedRound(
            context, season, upcoming, _upcomingRoundId, "mc-intermediate",
            DateTimeOffset.UtcNow.AddDays(60), problems: 2);

        // The practice group: no closing instant, so no embargo either, and takeable again.
        var practice = Group(
            context, "mc-practice", DateTimeOffset.UtcNow.AddDays(-30), closesAt: null, allowsReentry: true);
        SeedRound(context, season, practice, _practiceRoundId, "mc", visibleSince: null, problems: 1);

        // A group whose problems have already come out, so its round is open to everybody.
        var opened = Group(
            context, "mc-opened", DateTimeOffset.UtcNow.AddDays(-60), DateTimeOffset.UtcNow.AddDays(-1),
            allowsReentry: false);
        SeedRound(
            context, season, opened, _openedRoundId, "mc-advanced", DateTimeOffset.UtcNow.AddDays(-1),
            problems: 1, seasonYear: 2025);

        // A group whose rounds have not been applied yet, which is what one looks like between the two CLI runs
        // that declare it.
        Group(context, "mc-empty", DateTimeOffset.UtcNow.AddDays(-1), closesAt, allowsReentry: false)
            .Id = _emptyGroupId;

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
    /// <returns>The tracked group.</returns>
    private static HostedGroup Group(
        MathCompsDbContext context, string slug, DateTimeOffset opensAt, DateTimeOffset? closesAt,
        bool allowsReentry)
    {
        // The group row.
        var group = new HostedGroup
        {
            Id = Guid.CreateVersion7(),
            Slug = slug,
            OpensAt = opensAt,
            ClosesAt = closesAt,
            ClockMinutes = 180,
            AllowsReentry = allowsReentry,
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
    /// <param name="roundId">The id the tests address the round by.</param>
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

            // Its statement in each language, so the answer can be checked for carrying all of them.
            foreach (var (language, prefix) in new[]
                     {
                         (Language.SK, "Zadanie"), (Language.CS, "Zadání"), (Language.EN, "Statement"),
                     })
            {
                context.ProblemTexts.Add(new ProblemText
                {
                    Id = Guid.NewGuid(),
                    ProblemId = problem.Id,
                    DocumentType = DocumentType.Statement,
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
    /// <param name="roundId">Which competition to find.</param>
    /// <returns>The competition.</returns>
    private static HostedCompetitionDto CompetitionIn(HostedCompetitionsViewDto view, Guid roundId) =>
        view.Groups
            .SelectMany(group => group.Competitions)
            .Single(competition => competition.Id == roundId);
}
