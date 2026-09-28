using MathComps.Domain.Contracts.Admin;
using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Admin;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MathComps.Infrastructure.Tests.Admin;

/// <summary>
/// Integration tests for <see cref="AdminGradingService"/> against a real PostgreSQL database: who a group's board
/// grades and which conversations it counts for them, what one grade is read from, and how a grade takes a change,
/// keeps every version, and holds two changes sent together.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class AdminGradingServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IAdminGradingService>(fixture)
{
    /// <summary>
    /// How long the seeded groups' clocks run.
    /// </summary>
    private const int ClockMinutes = 180;

    /// <summary>
    /// What addresses the graded group.
    /// </summary>
    private const string GradedSlug = "mc-graded";

    /// <summary>
    /// What addresses the practice group.
    /// </summary>
    private const string PracticeSlug = "mc-practice";

    /// <summary>
    /// When every seeded clock started, days before the graded group closed.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 15, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// When the graded group closed, after which its problems are anybody's to practise on.
    /// </summary>
    private static readonly DateTimeOffset _closesAt = new(2026, 9, 20, 22, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// The grader making most of the changes.
    /// </summary>
    private readonly Guid _graderId = Guid.CreateVersion7();

    /// <summary>
    /// A second grader, so a version can be told apart by who wrote it.
    /// </summary>
    private readonly Guid _otherGraderId = Guid.CreateVersion7();

    /// <summary>
    /// A student who sat the advanced round and handed in an hour into the clock.
    /// </summary>
    private readonly Guid _aliceId = Guid.CreateVersion7();

    /// <summary>
    /// A student who sat the advanced round until the clock ran out.
    /// </summary>
    private readonly Guid _bobId = Guid.CreateVersion7();

    /// <summary>
    /// A student who gave the advanced round up to read its problems.
    /// </summary>
    private readonly Guid _carolId = Guid.CreateVersion7();

    /// <summary>
    /// A student the site let past its gates, who sat the advanced round that way.
    /// </summary>
    private readonly Guid _grantedId = Guid.CreateVersion7();

    /// <summary>
    /// A student who sat the elementary round, and the practice one besides.
    /// </summary>
    private readonly Guid _danId = Guid.CreateVersion7();

    /// <summary>
    /// A student who never entered, and practised on an advanced problem once the group had closed.
    /// </summary>
    private readonly Guid _strangerId = Guid.CreateVersion7();

    /// <summary>
    /// The graded group's elementary round.
    /// </summary>
    private readonly Guid _elementaryRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The graded group's advanced round.
    /// </summary>
    private readonly Guid _advancedRoundId = Guid.CreateVersion7();

    /// <summary>
    /// The advanced round's first problem, the one most conversations are about.
    /// </summary>
    private readonly Guid _advancedFirstId = Guid.CreateVersion7();

    /// <summary>
    /// The advanced round's second problem.
    /// </summary>
    private readonly Guid _advancedSecondId = Guid.CreateVersion7();

    /// <summary>
    /// The elementary round's first problem.
    /// </summary>
    private readonly Guid _elementaryFirstId = Guid.CreateVersion7();

    /// <summary>
    /// The elementary round's second problem.
    /// </summary>
    private readonly Guid _elementarySecondId = Guid.CreateVersion7();

    /// <summary>
    /// The practice round's only problem.
    /// </summary>
    private readonly Guid _practiceProblemId = Guid.CreateVersion7();

    /// <summary>
    /// Alice's entry into the advanced round.
    /// </summary>
    private readonly Guid _aliceEntryId = Guid.CreateVersion7();

    /// <summary>
    /// Alice's first conversation about the advanced round's first problem, started ten minutes in.
    /// </summary>
    private readonly Guid _aliceFirstSessionId = Guid.CreateVersion7();

    /// <summary>
    /// Alice's second conversation about the advanced round's first problem, started half an hour in.
    /// </summary>
    private readonly Guid _aliceSecondSessionId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The reader of who is let past the gates.
        services.AddUserGrants();

        // The service under test.
        services.AddScoped<IAdminGradingService, AdminGradingService>();

        // The names a group is called by.
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();
    }

    /// <summary>
    /// The board sets out each competition of the group, its problems in order, and every graded entrant on every
    /// problem, counting only the conversations each entrant started while their entry counted: Alice's third
    /// conversation came after she handed in, her practice on the second problem after the close, and Bob's second
    /// after his clock ran out. Nobody holds a grade yet.
    /// </summary>
    [Fact]
    public Task The_board_sets_out_every_graded_entrant_on_every_problem() => RunTestAsync(async service =>
    {
        // Read the graded group's board
        var board = await service.GetBoardAsync(GradedSlug);

        // Both competitions, in the order the taxonomy sets them out
        Assert.Equal(
            [HostedCompetitionCategory.Elementary, HostedCompetitionCategory.Advanced],
            board.Competitions.Select(competition => competition.Category));

        // The advanced competition, second in that order
        var advanced = board.Competitions[1];

        // Carrying the advanced round's id
        Assert.Equal(_advancedRoundId, advanced.RoundId);

        // The advanced round's problems, in order
        Assert.Equal([_advancedFirstId, _advancedSecondId], advanced.Problems.Select(problem => problem.Id));

        // Numbered from one
        Assert.Equal([1, 2], advanced.Problems.Select(problem => problem.Number));

        // Graded are Alice and Bob, by username
        Assert.Equal(["Alice", "Bob"], advanced.Entrants.Select(entrant => entrant.Username));

        // Each of them on each problem
        Assert.Equal(4, advanced.Grades.Count);

        // Alice's two conversations inside her entry, the one after her hand-in left out
        Assert.Equal(2, GradeOf(board, _aliceId, _advancedFirstId).ConversationCount);

        // None of Alice's on the second problem, her practice after the close left out
        Assert.Equal(0, GradeOf(board, _aliceId, _advancedSecondId).ConversationCount);

        // Bob held nothing on the first problem
        Assert.Equal(0, GradeOf(board, _bobId, _advancedFirstId).ConversationCount);

        // Bob's one conversation just inside his clock, the one just past it left out
        Assert.Equal(1, GradeOf(board, _bobId, _advancedSecondId).ConversationCount);

        // The elementary competition grades Dan alone
        Assert.Equal([_danId], board.Competitions[0].Entrants.Select(entrant => entrant.Id));

        // Dan's one conversation on its first problem
        Assert.Equal(1, GradeOf(board, _danId, _elementaryFirstId).ConversationCount);

        // None of Dan's on its second
        Assert.Equal(0, GradeOf(board, _danId, _elementarySecondId).ConversationCount);

        // And nobody has graded anything yet
        Assert.All(
            board.Competitions.SelectMany(competition => competition.Grades),
            summary => Assert.Null(summary.Grade));
    });

    /// <summary>
    /// The board names its group by the node its first round runs under, in every language, and says when the group
    /// took entries.
    /// </summary>
    [Fact]
    public Task The_board_names_its_group_and_when_it_took_entries() => RunTestAsync(async service =>
    {
        // Read the graded group's board
        var board = await service.GetBoardAsync(GradedSlug);

        // The names the taxonomy gives its nodes
        var localization = new MetadataLocalizationService();

        // What it calls the node the first round runs under, language by language
        var expected = Enum.GetValues<Language>().ToDictionary(
            language => language,
            language => localization.GetNodeShortName(language, "mathcomps-elementary-september"));

        // The board names its group that
        Assert.Equal(expected, board.Name);

        // No language leaves it blank
        Assert.All(board.Name.Values, name => Assert.NotEqual(string.Empty, name));

        // Opened when the group was seeded to open
        Assert.Equal(_startedAt.AddDays(-5), board.OpensAt);

        // Closed when the group was seeded to close
        Assert.Equal(_closesAt, board.ClosesAt);
    });

    /// <summary>
    /// Only a run held to the gates is graded: an entry given up for the problems is no run whatever was argued
    /// under it, a run the site let past its gates is nobody's to grade, and a student who never entered is no
    /// entrant however much they practised afterwards.
    /// </summary>
    [Fact]
    public Task Nobody_but_an_entrant_held_to_the_gates_is_on_the_board() => RunTestAsync(async service =>
    {
        // Read the graded group's board
        var board = await service.GetBoardAsync(GradedSlug);

        // Everybody it grades, across every competition
        var graded = board.Competitions
            .SelectMany(competition => competition.Entrants)
            .Select(entrant => entrant.Id)
            .ToList();

        // Not Carol, who gave her entry up
        Assert.DoesNotContain(_carolId, graded);

        // Not the granted student, let past the gates
        Assert.DoesNotContain(_grantedId, graded);

        // Not the stranger, who never entered
        Assert.DoesNotContain(_strangerId, graded);
    });

    /// <summary>
    /// A slug naming no graded group has no board: the practice group never closes and grades nobody, and a slug
    /// naming nothing names nothing.
    /// </summary>
    [Fact]
    public Task A_slug_naming_no_graded_group_has_no_board() => RunTestAsync(async service =>
    {
        // The practice group is refused
        await Assert.ThrowsAsync<HostedGroupNotFoundException>(
            () => service.GetBoardAsync(PracticeSlug));

        // A slug naming no group at all is refused
        await Assert.ThrowsAsync<HostedGroupNotFoundException>(
            () => service.GetBoardAsync("mc-nowhere"));
    });

    /// <summary>
    /// A grade is read from the conversations the entrant started while their entry counted, oldest first, each whole
    /// with its turns in order, and leaves out the one started after the hand-in. It carries what the entrant said
    /// about their own solution too, nothing where they said nothing, and no grade while nobody has given one.
    /// </summary>
    [Fact]
    public Task A_grade_is_read_from_the_conversations_started_inside_the_entry() => RunTestAsync(async service =>
    {
        // Read Alice's grade on the first advanced problem
        var detail = await service.GetGradeAsync(_advancedFirstId, _aliceId);

        // Her two conversations from inside the entry, oldest first
        Assert.Equal(
            [_aliceFirstSessionId, _aliceSecondSessionId],
            detail.Conversations.Select(conversation => conversation.Id));

        // The first of them
        var first = detail.Conversations[0];

        // Carrying the statement she saw
        Assert.Equal("Statement", first.Statement);

        // Carrying the reference the examiner held
        Assert.Equal("Reference", first.Reference);

        // The first conversation's turns in the order they were said, whatever order they were stored in
        Assert.Equal(["opening", "reply"], first.Turns.Select(turn => turn.Content));

        // What she said about her solution
        Assert.Equal("The second case is complete.", detail.SelfAssessment?.Comment);

        // Stamped with when she last changed it
        Assert.Equal(_startedAt.AddMinutes(55), detail.SelfAssessment?.UpdatedAt);

        // Nothing graded yet
        Assert.Null(detail.Grade);

        // On the problem she said nothing about, there is nothing to carry
        Assert.Null((await service.GetGradeAsync(_advancedSecondId, _aliceId)).SelfAssessment);
    });

    /// <summary>
    /// A grade nobody gives is refused: an entry given up, a run let past the gates, a student who never entered, and
    /// the practice group. An id naming no problem at all is refused too, and a write for a given-up entry is refused
    /// and leaves no version.
    /// </summary>
    [Fact]
    public Task A_grade_nobody_gives_is_refused() => RunTestAsync(async service =>
    {
        // Carol gave her entry up
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.GetGradeAsync(_advancedFirstId, _carolId));

        // The granted student was let past the gates
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.GetGradeAsync(_advancedFirstId, _grantedId));

        // The stranger never entered
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.GetGradeAsync(_advancedFirstId, _strangerId));

        // Dan's practice run grades nothing
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.GetGradeAsync(_practiceProblemId, _danId));

        // An id naming no problem at all
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.GetGradeAsync(Guid.CreateVersion7(), _aliceId));

        // The same refusal meets a write
        await Assert.ThrowsAsync<HostedGradeTargetException>(
            () => service.UpdateGradeAsync(_graderId, _advancedFirstId, _carolId, WithMark(3)));

        // The refused write left no version
        Assert.Equal(0, await CountGradeRowsAsync());
    });

    /// <summary>
    /// The first change writes the grade, carrying the grader who made it, and both the board and the grade's own
    /// read hand it back as it stands.
    /// </summary>
    [Fact]
    public Task The_first_change_writes_the_grade_with_its_grader() => RunTestAsync(async service =>
    {
        // A mark for Alice's first problem
        var grade = await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(5));

        // Handed back
        Assert.NotNull(grade);

        // Carrying the mark
        Assert.Equal(5, grade.Mark);

        // No help
        Assert.Equal(0, grade.Help);

        // No comment
        Assert.Equal(string.Empty, grade.InternalComment);

        // Not settled
        Assert.False(grade.IsFinal);

        // Written by the grader who made it
        Assert.Equal(_graderId, grade.UpdatedBy.Id);

        // The grader is named by their username
        Assert.Equal("Grader", grade.UpdatedBy.Username);

        // The graded group's board, read after the change
        var board = await service.GetBoardAsync(GradedSlug);

        // The board carries the grade for Alice's first problem
        Assert.Equal(grade, GradeOf(board, _aliceId, _advancedFirstId).Grade);

        // The grade's own read carries it too
        Assert.Equal(grade, (await service.GetGradeAsync(_advancedFirstId, _aliceId)).Grade);
    });

    /// <summary>
    /// A change carries only what changed, so a comment saved after a mark and its help were set and the grade
    /// settled leaves all three standing.
    /// </summary>
    [Fact]
    public Task A_comment_saved_after_a_mark_keeps_the_mark() => RunTestAsync(async service =>
    {
        // A mark and its help, settled
        await service.UpdateGradeAsync(
            _graderId, _advancedFirstId, _aliceId, new UpdateGradeRequest(new GradeMarkChange(4), 2, null, true));

        // Then a comment on its own
        var grade = await service.UpdateGradeAsync(
            _graderId, _advancedFirstId, _aliceId, new UpdateGradeRequest(null, null, "Clean second half.", null));

        // Handed back
        Assert.NotNull(grade);

        // The mark still standing
        Assert.Equal(4, grade.Mark);

        // The help still standing
        Assert.Equal(2, grade.Help);

        // Still settled
        Assert.True(grade.IsFinal);

        // The comment on top of them
        Assert.Equal("Clean second half.", grade.InternalComment);
    });

    /// <summary>
    /// Every change is kept as its own version with the grader who made it, and the grade reads as whoever changed
    /// it last.
    /// </summary>
    [Fact]
    public Task Every_change_is_kept_with_its_grader() => RunTestAsync(async service =>
    {
        // One grader marks it
        await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(3));

        // And another moves the mark
        var grade = await service.UpdateGradeAsync(_otherGraderId, _advancedFirstId, _aliceId, WithMark(4));

        // Handed back
        Assert.NotNull(grade);

        // Reading as the second grader's
        Assert.Equal(_otherGraderId, grade.UpdatedBy.Id);

        // Every version written, oldest first
        var versions = await QueryValueAsync(context => context.HostedGrades
            .OrderBy(version => version.CreatedAt)
            .Select(version => new { version.AuthorId, version.Mark })
            .ToListAsync());

        // Both kept, each with its own grader
        Assert.Equal(
            [(_graderId, 3), (_otherGraderId, 4)],
            versions.Select(version => (version.AuthorId, version.Mark)));
    });

    /// <summary>
    /// A change that leaves the grade as it was writes no version, so resending a grade as it stands does not pad
    /// the history, and the grade stays the first grader's even when another resends it. Where nobody has graded
    /// the student on the problem, there is then still no grade to hand back.
    /// </summary>
    [Fact]
    public Task A_change_that_moves_nothing_writes_nothing() => RunTestAsync(async service =>
    {
        // A mark
        await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(3));

        // The same mark again, from another grader
        var grade = await service.UpdateGradeAsync(_otherGraderId, _advancedFirstId, _aliceId, WithMark(3));

        // One version written
        Assert.Equal(1, await CountGradeRowsAsync());

        // The grade still the first grader's
        Assert.Equal(_graderId, grade?.UpdatedBy.Id);

        // An empty comment where nobody has graded Bob on the second problem
        var nothing = await service.UpdateGradeAsync(
            _graderId, _advancedSecondId, _bobId, new UpdateGradeRequest(null, null, string.Empty, null));

        // Still no grade to hand back
        Assert.Null(nothing);

        // No second version written
        Assert.Equal(1, await CountGradeRowsAsync());
    });

    /// <summary>
    /// Help is a part of the mark, so lowering the mark below it pulls the help down with it.
    /// </summary>
    [Fact]
    public Task Lowering_the_mark_pulls_the_help_down() => RunTestAsync(async service =>
    {
        // Five, three of them from the examiner
        await service.UpdateGradeAsync(
            _graderId, _advancedFirstId, _aliceId, new UpdateGradeRequest(new GradeMarkChange(5), 3, null, null));

        // The mark lowered to two
        var grade = await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(2));

        // Handed back
        Assert.NotNull(grade);

        // Carrying the lowered mark
        Assert.Equal(2, grade.Mark);

        // The help pulled down to all of it
        Assert.Equal(2, grade.Help);
    });

    /// <summary>
    /// Taking the mark back leaves no help and nothing settled, while what was written stays.
    /// </summary>
    [Fact]
    public Task Taking_the_mark_back_clears_the_help_and_final() => RunTestAsync(async service =>
    {
        // A settled five with help and a comment
        await service.UpdateGradeAsync(
            _graderId, _advancedFirstId, _aliceId, new UpdateGradeRequest(new GradeMarkChange(5), 1, "Solid.", true));

        // The mark taken back
        var grade = await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(null));

        // Handed back
        Assert.NotNull(grade);

        // No mark
        Assert.Null(grade.Mark);

        // No help
        Assert.Equal(0, grade.Help);

        // Not settled
        Assert.False(grade.IsFinal);

        // The comment still there
        Assert.Equal("Solid.", grade.InternalComment);
    });

    /// <summary>
    /// A change leaving a grade that breaks its rules is refused and writes nothing: a mark past the ceiling or
    /// below nothing, help below nothing or beyond the mark whether sent with it or standing against it, help
    /// without a mark, and settling no mark. Help of nothing without a mark is no break, since a blank grade
    /// already holds that help, and neither is settling a zero, which is a mark like any other.
    /// </summary>
    [Fact]
    public Task A_change_breaking_the_rules_is_refused() => RunTestAsync(async service =>
    {
        // A function which sends a change to Alice's grade on the first advanced problem
        Task<GradeDto?> Change(UpdateGradeRequest change) =>
            service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, change);

        // A mark past the ceiling
        await Assert.ThrowsAsync<HostedGradeValueException>(() => Change(WithMark(HostedGrade.MaxMark + 1)));

        // A mark below nothing
        await Assert.ThrowsAsync<HostedGradeValueException>(() => Change(WithMark(-1)));

        // Help below nothing
        await Assert.ThrowsAsync<HostedGradeValueException>(
            () => Change(new UpdateGradeRequest(new GradeMarkChange(2), -1, null, null)));

        // Help beyond the mark sent with it
        await Assert.ThrowsAsync<HostedGradeValueException>(
            () => Change(new UpdateGradeRequest(new GradeMarkChange(2), 3, null, null)));

        // Help without a mark
        await Assert.ThrowsAsync<HostedGradeValueException>(() => Change(new UpdateGradeRequest(null, 1, null, null)));

        // Settling no mark
        await Assert.ThrowsAsync<HostedGradeValueException>(
            () => Change(new UpdateGradeRequest(null, null, null, true)));

        // Help of nothing without a mark passes, as a change that moves nothing
        Assert.Null(await Change(new UpdateGradeRequest(null, 0, null, null)));

        // None of those changes wrote a version
        Assert.Equal(0, await CountGradeRowsAsync());

        // A two standing
        await Change(WithMark(2));

        // Help beyond the standing two is refused
        await Assert.ThrowsAsync<HostedGradeValueException>(() => Change(new UpdateGradeRequest(null, 3, null, null)));

        // The two's version is the only one written
        Assert.Equal(1, await CountGradeRowsAsync());

        // A zero, settled
        var zero = await Change(new UpdateGradeRequest(new GradeMarkChange(0), null, null, true));

        // The zero stands settled, as given
        Assert.Equal((0, true), (zero?.Mark, zero?.IsFinal));
    });

    /// <summary>
    /// A student who sat two rounds of the group is weighed by each round's own clock: their advanced conversation
    /// counts on the advanced problem, and an elementary one held while only the advanced clock ran counts nowhere,
    /// on the board or in the grade read. They are graded in both competitions.
    /// </summary>
    [Fact]
    public Task A_student_in_two_rounds_is_weighed_by_each_rounds_own_clock() => RunTestAsync(async service =>
    {
        // When Dan's advanced clock starts, a day after the rest
        var advancedStartedAt = _startedAt.AddDays(1);

        // Dan, who sat the elementary round, sits the advanced one too
        await QueryAsync(async context =>
        {
            // His advanced entry
            context.HostedEntries.Add(new HostedEntry
            {
                UserId = _danId,
                RoundId = _advancedRoundId,
                StartedAt = advancedStartedAt,
            });

            // Arguing an advanced problem inside it
            NewConversation(
                context, Guid.CreateVersion7(), _danId, _advancedFirstId, advancedStartedAt.AddMinutes(10));

            // And an elementary one meanwhile, long after his elementary clock ran out
            NewConversation(
                context, Guid.CreateVersion7(), _danId, _elementarySecondId, advancedStartedAt.AddMinutes(20));

            // Submit changes
            await context.SaveChangesAsync();
        });

        // Read the board
        var board = await service.GetBoardAsync(GradedSlug);

        // Dan graded in every competition
        Assert.All(
            board.Competitions,
            competition => Assert.Contains(_danId, competition.Entrants.Select(entrant => entrant.Id)));

        // His advanced conversation counted on the advanced problem
        Assert.Equal(1, GradeOf(board, _danId, _advancedFirstId).ConversationCount);

        // The elementary one held on the advanced clock counted for nothing
        Assert.Equal(0, GradeOf(board, _danId, _elementarySecondId).ConversationCount);

        // Reading that grade finds nothing either
        Assert.Empty((await service.GetGradeAsync(_elementarySecondId, _danId)).Conversations);

        // Reading his advanced grade finds the conversation it counted
        Assert.Single((await service.GetGradeAsync(_advancedFirstId, _danId)).Conversations);
    });

    /// <summary>
    /// A change lands as the grade even where the version it builds on is stamped later than the clock now reads,
    /// as it is once the clock has stepped back, since the newest stamp is what makes a version the grade.
    /// </summary>
    [Fact]
    public Task A_change_lands_even_after_the_clock_stepped_back() => RunTestAsync(async service =>
    {
        // A version stamped an hour ahead of the clock
        await QueryAsync(async context =>
        {
            // The version
            context.HostedGrades.Add(new HostedGrade
            {
                EntryId = _aliceEntryId,
                ProblemId = _advancedFirstId,
                Mark = 3,
                Help = 0,
                InternalComment = string.Empty,
                IsFinal = false,
                AuthorId = _otherGraderId,
                CreatedAt = DateTimeOffset.UtcNow.AddHours(1).TruncateToMicroseconds(),
            });

            // Submit changes
            await context.SaveChangesAsync();
        });

        // A change of the mark
        var grade = await service.UpdateGradeAsync(_graderId, _advancedFirstId, _aliceId, WithMark(5));

        // Handed back as the grade, by the grader who made it
        Assert.Equal((5, _graderId), (grade?.Mark, grade?.UpdatedBy.Id));
    });

    /// <summary>
    /// A change waits while another holds the entry, and then builds on the grade the other left rather than on
    /// the one it would have read before. Two changes run side by side would mostly pass without the lock, so the
    /// other change is held open by hand until this one is seen queued behind it.
    /// </summary>
    [Fact]
    public Task A_change_waiting_on_the_entry_builds_on_the_one_ahead_of_it() => RunTestAsync(async service =>
    {
        // Another grader's change, held open on Alice's entry while a comment arrives
        await QueryAsync(async context =>
        {
            // Another grader in the middle of a change
            await using var transaction = await context.Database.BeginTransactionAsync();

            // Holding Alice's entry
            await context.Database.ExecuteSqlAsync(
                $"SELECT 1 FROM hosted_entries WHERE id = {_aliceEntryId} FOR UPDATE");

            // A comment sent meanwhile, left waiting on the entry
            var waiting = service.UpdateGradeAsync(
                _graderId, _advancedFirstId, _aliceId, new UpdateGradeRequest(null, null, "Late.", null));

            // Wait until the comment is queued behind the held entry
            await WaitForLockWaiterAsync();

            // The other grader's mark
            context.HostedGrades.Add(new HostedGrade
            {
                EntryId = _aliceEntryId,
                ProblemId = _advancedFirstId,
                Mark = 4,
                Help = 0,
                InternalComment = string.Empty,
                IsFinal = false,
                AuthorId = _otherGraderId,
                CreatedAt = DateTimeOffset.UtcNow.TruncateToMicroseconds(),
            });

            // Written inside the held change
            await context.SaveChangesAsync();

            // The other change finished, letting the comment through
            await transaction.CommitAsync();

            // The comment, once let through
            var grade = await waiting;

            // Handed back
            Assert.NotNull(grade);

            // Carrying the mark the comment waited behind
            Assert.Equal(4, grade.Mark);

            // Carrying the comment too
            Assert.Equal("Late.", grade.InternalComment);
        });
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The graders and the students
        context.Users.AddRange(
            NewUser(_graderId, "Grader"),
            NewUser(_otherGraderId, "OtherGrader"),
            NewUser(_aliceId, "Alice"),
            NewUser(_bobId, "Bob"),
            NewUser(_carolId, "Carol"),
            NewUser(_grantedId, "Granted"),
            NewUser(_danId, "Dan"),
            NewUser(_strangerId, "Stranger"));

        // What lets one of them past the gates
        context.UserGrants.Add(new UserGrant
        {
            UserId = _grantedId,
            Capability = UserCapability.BypassCompetitionGates,
        });

        // The one season every round sits in
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The graded group, closed
        var graded = NewGroup(context, GradedSlug, _closesAt);

        // Its elementary round, placed first
        NewRound(context, season, graded, _elementaryRoundId, "mathcomps-elementary-september",
            _elementaryFirstId, _elementarySecondId);

        // Its advanced round
        NewRound(context, season, graded, _advancedRoundId, "mathcomps-advanced-september",
            _advancedFirstId, _advancedSecondId);

        // The practice group, which never closes
        var practice = NewGroup(context, PracticeSlug, closesAt: null);

        // The practice round's id
        var practiceRoundId = Guid.CreateVersion7();

        // That round, holding the one problem
        NewRound(context, season, practice, practiceRoundId, "mathcomps-practice", _practiceProblemId);

        // Alice handed in an hour into her clock
        context.HostedEntries.Add(new HostedEntry
        {
            Id = _aliceEntryId,
            UserId = _aliceId,
            RoundId = _advancedRoundId,
            StartedAt = _startedAt,
            FinishedAt = _startedAt.AddMinutes(60),
        });

        // Her first conversation inside it, its turns stored out of order
        NewConversation(context, _aliceFirstSessionId, _aliceId, _advancedFirstId, _startedAt.AddMinutes(10),
            [(1, TranscriptRole.Examiner, "reply"), (0, TranscriptRole.Candidate, "opening")]);

        // Her second conversation inside it
        NewConversation(context, _aliceSecondSessionId, _aliceId, _advancedFirstId, _startedAt.AddMinutes(30));

        // What she said about her solution to the first problem
        context.ProblemSelfAssessments.Add(new ProblemSelfAssessment
        {
            UserId = _aliceId,
            ProblemId = _advancedFirstId,
            Comment = "The second case is complete.",
            CreatedAt = _startedAt.AddMinutes(40),
            UpdatedAt = _startedAt.AddMinutes(55),
        });

        // A conversation she started after handing in
        NewConversation(context, Guid.CreateVersion7(), _aliceId, _advancedFirstId, _startedAt.AddMinutes(90));

        // Her practice on the other problem after the close
        NewConversation(context, Guid.CreateVersion7(), _aliceId, _advancedSecondId, _closesAt.AddDays(1));

        // Bob ran the whole clock
        context.HostedEntries.Add(NewEntry(_bobId, _advancedRoundId));

        // A conversation of his just inside the clock
        NewConversation(context, Guid.CreateVersion7(), _bobId, _advancedSecondId, _startedAt.AddMinutes(170));

        // And one of his just past it
        NewConversation(context, Guid.CreateVersion7(), _bobId, _advancedSecondId, _startedAt.AddMinutes(200));

        // Carol gave her entry up to read the problems
        context.HostedEntries.Add(new HostedEntry
        {
            UserId = _carolId,
            RoundId = _advancedRoundId,
            ForfeitedAt = _startedAt,
        });

        // Carol argued one of them anyway
        NewConversation(context, Guid.CreateVersion7(), _carolId, _advancedFirstId, _startedAt.AddMinutes(5));

        // The granted student sat the advanced round past the gates
        context.HostedEntries.Add(NewEntry(_grantedId, _advancedRoundId));

        // Arguing a problem inside the clock
        NewConversation(context, Guid.CreateVersion7(), _grantedId, _advancedFirstId, _startedAt.AddMinutes(5));

        // Dan sat the elementary round
        context.HostedEntries.Add(NewEntry(_danId, _elementaryRoundId));

        // Arguing its first problem inside the clock
        NewConversation(context, Guid.CreateVersion7(), _danId, _elementaryFirstId, _startedAt.AddMinutes(20));

        // Dan sat the practice round too
        context.HostedEntries.Add(NewEntry(_danId, practiceRoundId));

        // Arguing its problem
        NewConversation(context, Guid.CreateVersion7(), _danId, _practiceProblemId, _startedAt.AddMinutes(20));

        // The stranger practised once the group had closed
        NewConversation(context, Guid.CreateVersion7(), _strangerId, _advancedFirstId, _closesAt.AddDays(1));

        // Submit changes
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Finds one entrant's grade on one problem on a board.
    /// </summary>
    /// <param name="board">The board to read.</param>
    /// <param name="userId">The entrant.</param>
    /// <param name="problemId">The problem.</param>
    /// <returns>The grade as the board lists it.</returns>
    private static GradeSummaryDto GradeOf(GradingBoardDto board, Guid userId, Guid problemId) =>
        board.Competitions
            .SelectMany(competition => competition.Grades)
            .Single(summary => summary.UserId == userId && summary.ProblemId == problemId);

    /// <summary>
    /// A change setting the mark or taking it back, and nothing else.
    /// </summary>
    /// <param name="mark">The mark, or null to take it back.</param>
    /// <returns>The change.</returns>
    private static UpdateGradeRequest WithMark(int? mark) => new(new GradeMarkChange(mark), null, null, null);

    /// <summary>
    /// Counts every version of every grade written so far.
    /// </summary>
    /// <returns>The count.</returns>
    private Task<int> CountGradeRowsAsync() => QueryValueAsync(context => context.HostedGrades.CountAsync());

    /// <summary>
    /// Waits until some connection to this test's database is queued behind a lock.
    /// </summary>
    private async Task WaitForLockWaiterAsync()
    {
        // Asked often, for a few seconds at most
        for (var attempt = 0; attempt < 200; attempt += 1)
        {
            // How many connections to this database are waiting on a lock right now
            var waiters = await QueryValueAsync(context => context.Database
                .SqlQueryRaw<int>(
                    """
                    SELECT count(*)::int AS "Value" FROM pg_stat_activity
                    WHERE datname = current_database() AND wait_event_type = 'Lock'
                    """)
                .SingleAsync());

            // One is what the test was waiting for
            if (waiters > 0)
                return;

            // Otherwise give it a moment
            await Task.Delay(25);
        }

        // Nothing ever queued, which is what a change taking no lock looks like
        throw new TimeoutException("No change ever waited on the entry.");
    }

    /// <summary>
    /// Builds one user, every field derived from their username.
    /// </summary>
    /// <param name="userId">The user's id.</param>
    /// <param name="username">The user's username.</param>
    /// <returns>The user.</returns>
    private static User NewUser(Guid userId, string username) => new()
    {
        Id = userId,
        ExternalId = $"ext-{username}",
        Username = username,
        Email = $"{username.ToLowerInvariant()}@example.com",
    };

    /// <summary>
    /// Builds one sat entry whose clock started with everybody else's and was never handed in.
    /// </summary>
    /// <param name="userId">The student.</param>
    /// <param name="roundId">The round entered.</param>
    /// <returns>The entry.</returns>
    private static HostedEntry NewEntry(Guid userId, Guid roundId) => new()
    {
        UserId = userId,
        RoundId = roundId,
        StartedAt = _startedAt,
    };

    /// <summary>
    /// Tracks one hosted group.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="slug">What addresses the group.</param>
    /// <param name="closesAt"><inheritdoc cref="HostedGroup.ClosesAt" path="/summary"/></param>
    /// <returns>The tracked group.</returns>
    private static HostedGroup NewGroup(MathCompsDbContext context, string slug, DateTimeOffset? closesAt)
    {
        // The group row
        var group = new HostedGroup
        {
            Id = Guid.CreateVersion7(),
            Slug = slug,
            OpensAt = _startedAt.AddDays(-5),
            ClosesAt = closesAt,
            ClockMinutes = ClockMinutes,
            AllowsReentry = closesAt is null,
            ProblemCount = 2,
        };
        context.HostedGroups.Add(group);

        // The tracked group
        return group;
    }

    /// <summary>
    /// Tracks one round of a group with its problems, numbered in the order given.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="group">The group it runs in.</param>
    /// <param name="roundId">The round's id.</param>
    /// <param name="competitionPath">The path of the competition it hangs under, which says its level.</param>
    /// <param name="problemIds">Its problems' ids, in order.</param>
    private static void NewRound(
        MathCompsDbContext context, Season season, HostedGroup group, Guid roundId, string competitionPath,
        params Guid[] problemIds)
    {
        // The round, under the deepest node its path names
        context.Rounds.Add(new Round
        {
            Id = roundId,
            CompetitionId = CompetitionTreeSeed.Chain(context, competitionPath).Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 9, 15),
            VisibleSince = group.ClosesAt,
            HostedGroupId = group.Id,
        });

        // Its problems
        for (var index = 0; index < problemIds.Length; index += 1)
            context.Problems.Add(new Problem
            {
                Id = problemIds[index],
                RoundId = roundId,
                Number = index + 1,
                Slug = $"{competitionPath}-{index + 1}",
            });
    }

    /// <summary>
    /// Tracks one conversation about one problem.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="sessionId">The conversation's id.</param>
    /// <param name="userId">The student holding it.</param>
    /// <param name="problemId">The problem it is about.</param>
    /// <param name="createdAt">When it started.</param>
    /// <param name="turns">What was said in it, by sequence; one opening line when left out.</param>
    private static void NewConversation(
        MathCompsDbContext context,
        Guid sessionId,
        Guid userId,
        Guid problemId,
        DateTimeOffset createdAt,
        (int Sequence, TranscriptRole Role, string Content)[]? turns = null)
    {
        // The session, stamped with the kind its target row is allowed to attach to
        context.DefenseSessions.Add(new DefenseSession
        {
            Id = sessionId,
            UserId = userId,
            TargetKind = DefenseTargetKind.Problem,
            ProblemStatement = "Statement",
            ProblemReference = "Reference",
            ExaminerConfig = "{}",
            CreatedAt = createdAt,
        });

        // What it is about
        context.ProblemDefenses.Add(new ProblemDefense { DefenseSessionId = sessionId, ProblemId = problemId });

        // And what was said in it
        foreach (var (sequence, role, content) in turns ?? [(0, TranscriptRole.Candidate, "opening")])
            context.DefenseTurns.Add(new DefenseTurn
            {
                Id = Guid.CreateVersion7(),
                SessionId = sessionId,
                Role = role,
                Content = content,
                Sequence = sequence,
                CreatedAt = createdAt.AddMinutes(sequence),
            });
    }
}
