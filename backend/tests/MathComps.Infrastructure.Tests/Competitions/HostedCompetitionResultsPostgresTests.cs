using MathComps.Domain.Contracts.Competitions;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.DependencyInjection;
using static MathComps.Infrastructure.Tests.TestInfrastructure.HostedSeed;

namespace MathComps.Infrastructure.Tests.Competitions;

/// <summary>
/// Integration tests for a hosted competition's results as <see cref="IHostedCompetitionService"/> reads them
/// against a real PostgreSQL database: who is listed, what each cell shows, how a tie on the total is broken and
/// when a place is shared, the school grade at the time of the round, that nothing is out before the group
/// closes, and the reader's own cells and results on the competitions view, the problems and an entry handed in
/// after the close.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class HostedCompetitionResultsPostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IHostedCompetitionService>(fixture)
{
    /// <summary>
    /// What addresses the round most of the results are read from.
    /// </summary>
    private const string RoundSlug = "advanced-september-2026";

    /// <summary>
    /// What addresses the round of the group that opened on the last day of June.
    /// </summary>
    private const string JuneSlug = "advanced-october-2026";

    /// <summary>
    /// What addresses the round of the group that opened on the first day of July.
    /// </summary>
    private const string JulySlug = "advanced-november-2026";

    /// <summary>
    /// What addresses the round of the group still taking entries.
    /// </summary>
    private const string OpenSlug = "elementary-october-2026";

    /// <summary>
    /// What addresses the round of the group that closed while Bob was still sitting it.
    /// </summary>
    private const string LateSlug = "elementary-november-2026";

    /// <summary>
    /// When every clock in the round started, Emil's an hour later.
    /// </summary>
    private static readonly DateTimeOffset _startedAt = new(2026, 9, 10, 10, 0, 0, TimeSpan.Zero);

    /// <summary>
    /// When every message about a grade was written, after the grades were given.
    /// </summary>
    private static readonly DateTimeOffset _messagedAt = _startedAt.AddDays(21);

    /// <summary>
    /// The grader every grade is written by.
    /// </summary>
    private readonly Guid _graderId = Guid.CreateVersion7();

    /// <summary>
    /// The round's first problem.
    /// </summary>
    private readonly Guid _firstId = Guid.CreateVersion7();

    /// <summary>
    /// The round's second problem.
    /// </summary>
    private readonly Guid _secondId = Guid.CreateVersion7();

    /// <summary>
    /// A student who sat the round, the open one and the late one, and the reader most of the tests read as.
    /// </summary>
    private readonly Guid _bobId = Guid.CreateVersion7();

    /// <summary>
    /// A student with a final grade on the first problem, talked over with the graders, and none yet on the
    /// second.
    /// </summary>
    private readonly Guid _filipId = Guid.CreateVersion7();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The registry the slugs resolve through
        services.AddLocalization();

        // The terms the service runs on, none of which the results read
        services.Configure<HostedCompetitionOptions>(options =>
        {
            options.NoteGraceMinutes = 30;
            options.MaxNoteChars = 1000;
        });

        // Who the site lets past its gates
        services.AddUserGrants();

        // The service under test
        services.AddScoped<IHostedCompetitionService, HostedCompetitionService>();
    }

    /// <summary>
    /// A tie on the total goes to whoever finished earlier: the sum, over the problems, of how far into their
    /// own clock they last wrote about each. Bob's 30 minutes beat Bea's 20 and 20; counting each conversation's
    /// first line instead would put Bea, who opened both a minute in, ahead. Only the student's own lines inside
    /// the window count, so neither Bob's line after his clock ran out nor Mathilda's late reply in his
    /// conversation drags him behind Bea, which either one would.
    /// </summary>
    [Fact]
    public Task A_tie_on_the_total_goes_to_whoever_finished_earlier() => RunTestAsync(async service =>
    {
        // The results
        var results = await service.GetResultsAsync(null, RoundSlug);

        // Bob and Bea, level on the total
        var bob = RowOf(results, "Bob");
        var bea = RowOf(results, "Bea");
        Assert.Equal(7m, TotalOf(bob));
        Assert.Equal(7m, TotalOf(bea));

        // Bob finished earlier, so he stands ahead
        Assert.Equal(2, bob.Place);
        Assert.Equal(3, bea.Place);
    });

    /// <summary>
    /// Students level on the total and on when they finished share a place, and the student after them takes the
    /// place after all of them, as in any ranking. When they finished counts from each one's own start, so Dora and Emil
    /// share a place though Emil sat down an hour later. A total of 0 is still a place. Only the students the
    /// graders grade who wrote about the problems inside their own window are listed. Left out: a student already
    /// preparing the competitions when their clock started, a student who sat the entry and said nothing, a student
    /// whose only conversation started after their clock ran out, though graded on it, and a student who gave the
    /// entry up. A deleted account with no
    /// final grade stands last, after the named ones, its name and country withheld, and the reader finds their own row marked as theirs and nobody else's.
    /// </summary>
    [Fact]
    public Task Students_level_on_both_share_a_place_and_the_next_one_skips_it() => RunTestAsync(async service =>
    {
        // The results, as Bob reads them
        var results = await service.GetResultsAsync(_bobId, RoundSlug);

        // Every row's place, in the order the rows stand
        var places = results.Rows.Select(row => (row.Student.Username, row.Place));

        // Dora and Emil share fourth, Filip is sixth, Hana's 0 seventh, and those with no final grade stand last,
        // unplaced
        Assert.Equal(
            [
                ("Ada", 1), ("Bob", 2), ("Bea", 3), ("Dora", 4), ("Emil", 4), ("Filip", 6), ("Hana", 7),
                ("Gita", null), (null, null),
            ],
            places);

        // The deleted account's country withheld with its name
        Assert.Null(results.Rows[^1].Student.CountryCode);

        // Bob's row alone is the reader's
        Assert.Equal(["Bob"], results.Rows.Where(row => row.IsReader).Select(row => row.Student.Username));
    });

    /// <summary>
    /// A grant handed over once the group has closed moves nobody: Filip keeps his place and so does everybody below
    /// him, and his own result still carries its grade and its conversation. Only a grant already held when the
    /// clock started keeps a run off the results, as Ivo's does.
    /// </summary>
    [Fact]
    public Task A_grant_handed_over_after_the_close_moves_nobody() => RunTestAsync(async service =>
    {
        // Every row's place before the grant
        var before = (await service.GetResultsAsync(null, RoundSlug)).Rows
            .Select(row => (row.Student.Username, row.Place))
            .ToList();

        // Filip granted the capability six days after the group closed
        await QueryAsync(async context =>
        {
            // The grant
            context.UserGrants.Add(new UserGrant
            {
                UserId = _filipId,
                Capability = UserCapability.PrepareCompetitions,
                GrantedAt = _startedAt.AddDays(25),
            });

            // Commit the grant
            await context.SaveChangesAsync();
        });

        // The results after the grant
        var after = await service.GetResultsAsync(null, RoundSlug);

        // Every row where it stood
        Assert.Equal(before, after.Rows.Select(row => (row.Student.Username, row.Place)));

        // Filip still sixth
        Assert.Equal(6, RowOf(after, "Filip").Place);

        // Ivo still left out
        Assert.DoesNotContain(after.Rows, row => row.Student.Username == "Ivo");

        // Filip's own result on the first problem, final, with the two messages standing in its conversation
        Assert.Equal(
            new FinalResultDto(2, 0, new GradeConversationDto($"{_firstId}:{_filipId}", 2)),
            (await service.GetProblemsAsync(_filipId, RoundSlug))[0].Result);
    });

    /// <summary>
    /// A problem the student wrote about waits on a final grade, a draft one included, while a problem they never
    /// wrote about shows nothing. Only final grades are scored, as the mark less half of the help, and a row with
    /// none has no total.
    /// </summary>
    [Fact]
    public Task A_problem_written_about_waits_on_a_final_grade_and_one_never_written_about_shows_nothing() =>
        RunTestAsync(async service =>
        {
            // The results
            var results = await service.GetResultsAsync(null, RoundSlug);

            // Ada's two final grades, one of them with help
            var ada = RowOf(results, "Ada");
            Assert.Equal([new ScoredCellDto(6m), new ScoredCellDto(3.5m)], ada.Cells);
            Assert.Equal(9.5m, TotalOf(ada));

            // Bob, scored on the first and silent on the second inside his window, a final grade on what he said
            // after it notwithstanding
            Assert.Equal([new ScoredCellDto(7m), new NoConversationCellDto()], RowOf(results, "Bob").Cells);

            // Filip, scored on the first and waiting on the second, which nobody graded
            var filip = RowOf(results, "Filip");
            Assert.Equal([new ScoredCellDto(2m), new PendingCellDto()], filip.Cells);
            Assert.Equal(2m, TotalOf(filip));

            // Gita, waiting on both, a draft grade among them
            var gita = RowOf(results, "Gita");
            Assert.Equal([new PendingCellDto(), new PendingCellDto()], gita.Cells);
            Assert.Null(TotalOf(gita));

            // Hana, silent on the first and scored nothing on the second
            var hana = RowOf(results, "Hana");
            Assert.Equal([new NoConversationCellDto(), new ScoredCellDto(0m)], hana.Cells);
            Assert.Equal(0m, TotalOf(hana));
        });

    /// <summary>
    /// A student's grade is the one they were in when the round's group opened, the school year turning on the
    /// first of July. Across a group opening on the last evening of June and one opening just after midnight, a
    /// 2026 maturant goes from the fourth year of high school to past it, and a student finishing in 2030 from the
    /// ninth year of primary school to the first of high school.
    /// </summary>
    [Fact]
    public Task The_school_year_turns_on_the_first_of_July() => RunTestAsync(async service =>
    {
        // The round on the June side of the turn
        var june = await service.GetResultsAsync(null, JuneSlug);

        // In June: the maturant in the last year of high school, the younger student in the last of primary school
        Assert.Equal(new HighSchoolGradeDto(4), RowOf(june, "Maturant").Student.Grade);
        Assert.Equal(new PrimarySchoolGradeDto(9), RowOf(june, "Pupil").Student.Grade);

        // The round on the July side
        var july = await service.GetResultsAsync(null, JulySlug);

        // In July: the maturant past high school, the younger student in its first year
        Assert.Equal(new PastHighSchoolDto(), RowOf(july, "Maturant").Student.Grade);
        Assert.Equal(new HighSchoolGradeDto(1), RowOf(july, "Pupil").Student.Grade);
    });

    /// <summary>
    /// The entry on the competitions view carries the reader's own cells once a group has closed: one cell per
    /// problem. A competition still running carries none, a final grade in it included, though the reader's own
    /// clock has run out.
    /// </summary>
    [Fact]
    public Task The_readers_own_cells_appear_once_the_group_closes() => RunTestAsync(async service =>
    {
        // The view, as Bob reads it
        var view = await service.GetViewAsync(_bobId);

        // His row of the closed round
        Assert.Equal([new ScoredCellDto(7m), new NoConversationCellDto()], CellsIn(view, RoundSlug));

        // Nothing for the round still running
        Assert.Null(CellsIn(view, OpenSlug));
    });

    /// <summary>
    /// Once the group has closed, each problem carries the reader's own result: a final grade with its mark, its
    /// help and the conversation the graders hold with them about it, named by the problem and the student and
    /// counting the messages standing in it, replies included and deleted or replaced ones not, and the messages
    /// of anybody else's conversation never; a problem still waiting on a final grade says so; and one written
    /// about only after the clock ran out shows nothing, a final grade on it included.
    /// </summary>
    [Fact]
    public Task The_readers_own_result_carries_the_grade_and_its_conversation() => RunTestAsync(async service =>
    {
        // The problems, as Filip reads them
        var problems = await service.GetProblemsAsync(_filipId, RoundSlug);

        // The first, final, with the two messages standing in its conversation
        Assert.Equal(
            new FinalResultDto(2, 0, new GradeConversationDto($"{_firstId}:{_filipId}", 2)),
            problems[0].Result);

        // The second, waiting
        Assert.Equal(new PendingResultDto(), problems[1].Result);

        // Bob's second, written about only once his clock had run out
        Assert.Equal(new NoConversationResultDto(), (await service.GetProblemsAsync(_bobId, RoundSlug))[1].Result);
    });

    /// <summary>
    /// A clock started just before the group closed runs on past the close, and handing such an entry in gives it
    /// back with its cells, the results being out by then.
    /// </summary>
    [Fact]
    public Task An_entry_handed_in_after_the_close_comes_back_with_its_cells() => RunTestAsync(async service =>
    {
        // Bob hands in the entry he started just before the close
        var entry = Assert.IsType<SatEntryDto>(await service.FinishAsync(_bobId, LateSlug));

        // Nothing written about on either problem, so nothing to mark
        Assert.Equal([new NoConversationCellDto(), new NoConversationCellDto()], entry.Cells);
    });

    /// <summary>
    /// Nothing of a competition's results is out while its group is still taking entries, to anybody: who took
    /// part is not public until it closes, and a student whose own clock has run out finds no result on their
    /// problems, a final grade included.
    /// </summary>
    [Fact]
    public Task Nothing_is_out_before_the_group_closes() => RunTestAsync(async service =>
    {
        // The results of a round still running, refused
        await Assert.ThrowsAsync<HostedResultsNotOutException>(() => service.GetResultsAsync(_bobId, OpenSlug));

        // Bob's problems there, none of them with a result
        Assert.All(await service.GetProblemsAsync(_bobId, OpenSlug), problem => Assert.Null(problem.Result));
    });

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The one season every round sits in
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the site's own competitions hang off
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The grader
        context.Users.Add(NewUser(_graderId, "Grader"));

        // The round, its group long closed, its problems written out to be read
        var roundId = Guid.CreateVersion7();
        var group = NewGroup(context, "mc-results", _startedAt.AddDays(-9), _startedAt.AddDays(19));
        NewRound(context, season, group, roundId, "mathcomps-advanced-september", _firstId, _secondId);
        Texts(context, _firstId);
        Texts(context, _secondId);

        // Ada: final on both, the second with a point of help
        var ada = Student(context, Guid.CreateVersion7(), "Ada", roundId);
        Conversation(context, ada, _firstId, 10);
        Conversation(context, ada, _secondId, 60);
        Grade(context, ada, _firstId, mark: 6, help: 0);
        Grade(context, ada, _secondId, mark: 4, help: 1);

        // A word with Ada on the first problem, no part of anybody else's conversation
        NewMessage(context, ada.Id, _firstId, _graderId, _messagedAt);

        // Bob: done 30 minutes in on the first
        var bob = Student(context, _bobId, "Bob", roundId);
        var bobsConversation = Conversation(context, bob, _firstId, 5, 30);

        // A late reply from Mathilda there, still inside his clock
        NewTurn(context, bobsConversation, 2, TranscriptRole.Examiner, _startedAt.AddMinutes(170));

        // And a line of his own once his clock had run out
        NewTurn(context, bobsConversation, 3, TranscriptRole.Candidate, _startedAt.AddMinutes(200));

        // Seven on the first
        Grade(context, bob, _firstId, mark: 7, help: 0);

        // The second written about only once his clock had run out, graded anyway
        Conversation(context, bob, _secondId, 200);
        Grade(context, bob, _secondId, mark: 7, help: 0);

        // Bea: seven over both, each opened a minute in and last written to 20 minutes in
        var bea = Student(context, Guid.CreateVersion7(), "Bea", roundId);
        Conversation(context, bea, _firstId, 1, 20);
        Conversation(context, bea, _secondId, 1, 20);
        Grade(context, bea, _firstId, mark: 5, help: 0);
        Grade(context, bea, _secondId, mark: 4, help: 4);

        // Dora: four, done 50 minutes in
        var dora = Student(context, Guid.CreateVersion7(), "Dora", roundId);
        Conversation(context, dora, _firstId, 50);
        Grade(context, dora, _firstId, mark: 4, help: 0);

        // Emil: four once his help is taken off, sitting down an hour after Dora and done 50 minutes in too
        var emil = Student(context, Guid.CreateVersion7(), "Emil", roundId);
        emil.StartedAt = _startedAt.AddHours(1);
        Conversation(context, emil, _firstId, 50);
        Grade(context, emil, _firstId, mark: 5, help: 2);

        // Filip: two on the first, the second still ungraded
        var filip = Student(context, _filipId, "Filip", roundId);
        Conversation(context, filip, _firstId, 15);
        Conversation(context, filip, _secondId, 25);
        Grade(context, filip, _firstId, mark: 2, help: 0);

        // The graders' word on Filip's first problem
        var explanation = NewMessage(context, filip.Id, _firstId, _graderId, _messagedAt);

        // Filip's answer as he first wrote it
        var firstWording = NewMessage(
            context, filip.Id, _firstId, _filipId, _messagedAt, CommentStatus.Superseded, explanation);

        // The same answer reworded, standing in its place
        NewMessage(context, filip.Id, _firstId, _filipId, _messagedAt, CommentStatus.Active, explanation)
            .PreviousVersionId = firstWording.Id;

        // And an aside of his, deleted
        NewMessage(context, filip.Id, _firstId, _filipId, _messagedAt, CommentStatus.Deleted);

        // Gita: a draft grade on the first, nothing on the second
        var gita = Student(context, Guid.CreateVersion7(), "Gita", roundId);
        Conversation(context, gita, _firstId, 10);
        Conversation(context, gita, _secondId, 20);
        Grade(context, gita, _firstId, mark: 3, help: 0, isFinal: false);

        // Hana: the second only, final at nothing
        var hana = Student(context, Guid.CreateVersion7(), "Hana", roundId);
        Conversation(context, hana, _secondId, 10);
        Grade(context, hana, _secondId, mark: 0, help: 0);

        // A deleted account: the first only, ungraded
        var gone = Student(context, Guid.CreateVersion7(), "Gone", roundId, isDeleted: true);
        Conversation(context, gone, _firstId, 10);

        // Ivo: seven on the first, but preparing the competitions since the day before his clock started
        var ivoId = Guid.CreateVersion7();
        var ivo = Student(context, ivoId, "Ivo", roundId);
        Conversation(context, ivo, _firstId, 10);
        Grade(context, ivo, _firstId, mark: 7, help: 0);
        context.UserGrants.Add(new UserGrant
        {
            UserId = ivoId,
            Capability = UserCapability.PrepareCompetitions,
            GrantedAt = _startedAt.AddDays(-1),
        });

        // Jana: sat it and said nothing
        Student(context, Guid.CreateVersion7(), "Jana", roundId);

        // Karol: wrote only once his clock had run out, and was graded on it anyway
        var karol = Student(context, Guid.CreateVersion7(), "Karol", roundId);
        Conversation(context, karol, _firstId, 200);
        Grade(context, karol, _firstId, mark: 7, help: 0);

        // Lea: gave the entry up
        var leaId = Guid.CreateVersion7();
        context.Users.Add(NewUser(leaId, "Lea"));
        context.HostedEntries.Add(new HostedEntry { UserId = leaId, RoundId = roundId, ForfeitedAt = _startedAt });

        // And talked the first problem through ten minutes later
        NewConversation(context, Guid.CreateVersion7(), leaId, _firstId, _startedAt.AddMinutes(10));

        // A 2026 maturant and a student finishing in 2030
        var maturant = NewUser(Guid.CreateVersion7(), "Maturant");
        maturant.GraduationYear = 2026;
        var pupil = NewUser(Guid.CreateVersion7(), "Pupil");
        pupil.GraduationYear = 2030;
        context.Users.AddRange(maturant, pupil);

        // The groups opening on the last evening of June and just after midnight, both sat by the two of them
        var juneOpening = new DateTimeOffset(2026, 6, 30, 23, 30, 0, TimeSpan.Zero);
        var julyOpening = new DateTimeOffset(2026, 7, 1, 0, 30, 0, TimeSpan.Zero);
        SchoolYearRound(context, season, "mathcomps-advanced-october", juneOpening, maturant.Id, pupil.Id);
        SchoolYearRound(context, season, "mathcomps-advanced-november", julyOpening, maturant.Id, pupil.Id);

        // A group still taking entries, its problems written out to be read
        var openRoundId = Guid.CreateVersion7();
        var openProblemId = Guid.CreateVersion7();
        var otherOpenProblemId = Guid.CreateVersion7();
        var open = NewGroup(context, "mc-open", DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(30));
        NewRound(context, season, open, openRoundId, "mathcomps-elementary-october", openProblemId, otherOpenProblemId);
        Texts(context, openProblemId);
        Texts(context, otherOpenProblemId);

        // Bob sat it too, his clock has long run out, and a grader has already marked him final there
        var bobsOpenEntry = NewEntry(_bobId, openRoundId, DateTimeOffset.UtcNow.AddHours(-4));
        context.HostedEntries.Add(bobsOpenEntry);
        Conversation(context, bobsOpenEntry, openProblemId, 10);
        Grade(context, bobsOpenEntry, openProblemId, mark: 7, help: 0);

        // A group that closed ten minutes ago, which Bob entered just before it did and is still sitting
        var lateRoundId = Guid.CreateVersion7();
        var late = NewGroup(
            context, "mc-late", DateTimeOffset.UtcNow.AddDays(-7), DateTimeOffset.UtcNow.AddMinutes(-10));
        NewRound(
            context, season, late, lateRoundId, "mathcomps-elementary-november", Guid.CreateVersion7(),
            Guid.CreateVersion7());
        context.HostedEntries.Add(NewEntry(_bobId, lateRoundId, DateTimeOffset.UtcNow.AddMinutes(-20)));

        // Save seeded data
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Tracks a student who sat the round, their clock starting at <see cref="_startedAt"/>.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="userId">The student's id.</param>
    /// <param name="username">The student's username.</param>
    /// <param name="roundId">The round they sat.</param>
    /// <param name="isDeleted"><inheritdoc cref="User.IsDeleted" path="/summary"/></param>
    /// <returns>Their entry.</returns>
    private static HostedEntry Student(
        MathCompsDbContext context, Guid userId, string username, Guid roundId, bool isDeleted = false)
    {
        // The student, from Slovakia, so a deleted account has a country to withhold
        var student = NewUser(userId, username);
        student.CountryCode = "SK";
        student.IsDeleted = isDeleted;
        context.Users.Add(student);

        // Their entry
        var entry = NewEntry(userId, roundId, _startedAt);
        context.HostedEntries.Add(entry);

        // The tracked entry
        return entry;
    }

    /// <summary>
    /// Tracks one conversation of a student about a problem, opened at the first of the given minutes into their
    /// clock, with a line of theirs at each of them.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="entry">The student's entry, whose clock the minutes count on.</param>
    /// <param name="problemId">The problem.</param>
    /// <param name="minutes">How far into the clock each of their lines came, the first one opening it.</param>
    /// <returns>The conversation's id.</returns>
    private static Guid Conversation(
        MathCompsDbContext context, HostedEntry entry, Guid problemId, params int[] minutes)
    {
        // Where the minutes count from
        var clockStartedAt = entry.StartedAt!.Value;

        // The conversation with its opening line
        var sessionId = Guid.CreateVersion7();
        NewConversation(context, sessionId, entry.UserId, problemId, clockStartedAt.AddMinutes(minutes[0]));

        // Every line after it
        for (var sequence = 1; sequence < minutes.Length; sequence += 1)
            NewTurn(
                context, sessionId, sequence, TranscriptRole.Candidate, clockStartedAt.AddMinutes(minutes[sequence]));

        // The conversation's id
        return sessionId;
    }

    /// <summary>
    /// Tracks the grade on one problem of an entry.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="entry">The entry graded.</param>
    /// <param name="problemId">The problem graded.</param>
    /// <param name="mark">The mark the work earns on its competition's scale, however much the examiner helped.</param>
    /// <param name="help"><inheritdoc cref="HostedGrade.Help" path="/summary"/></param>
    /// <param name="isFinal"><inheritdoc cref="HostedGrade.IsFinal" path="/summary"/></param>
    private void Grade(
        MathCompsDbContext context, HostedEntry entry, Guid problemId, int mark, int help, bool isFinal = true) =>
        // Written by the grader
        context.HostedGrades.Add(NewGrade(entry.Id, problemId, _graderId, mark, help, isFinal, _startedAt.AddDays(20)));

    /// <summary>
    /// Tracks a problem's statement and solution in every language the site is read in, which reading the
    /// problems asks of a hosted one.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="problemId">The problem.</param>
    private static void Texts(MathCompsDbContext context, Guid problemId) =>
        // One row per language and kind
        context.ProblemTexts.AddRange(
            Enum.GetValues<Language>().SelectMany(language =>
                new[] { DocumentType.Statement, DocumentType.Solution }.Select(documentType =>
                    SelectionSeed.NewText(problemId, documentType, language, 1))));

    /// <summary>
    /// Tracks a closed group opening at an instant, with one round under a node of its own that some students sat
    /// an hour after it opened, each writing about its first problem.
    /// </summary>
    /// <param name="context">The seeding context.</param>
    /// <param name="season">The season the round sits in.</param>
    /// <param name="competitionPath">The node the round hangs off.</param>
    /// <param name="opensAt"><inheritdoc cref="HostedGroup.OpensAt" path="/summary"/></param>
    /// <param name="userIds">The students who sat it.</param>
    private static void SchoolYearRound(
        MathCompsDbContext context, Season season, string competitionPath, DateTimeOffset opensAt,
        params Guid[] userIds)
    {
        // The group, closed a week after it opened
        var group = NewGroup(context, competitionPath, opensAt, opensAt.AddDays(7));

        // Its round
        var roundId = Guid.CreateVersion7();
        var problemId = Guid.CreateVersion7();
        NewRound(context, season, group, roundId, competitionPath, problemId, Guid.CreateVersion7());

        // Each student's entry and conversation
        foreach (var userId in userIds)
        {
            // The entry, an hour after the group opened
            var entry = NewEntry(userId, roundId, opensAt.AddHours(1));
            context.HostedEntries.Add(entry);

            // The conversation, ten minutes into it
            Conversation(context, entry, problemId, 10);
        }
    }

    /// <summary>
    /// Reads the reader's own cells in one competition of the competitions view, wherever its group sits.
    /// </summary>
    /// <param name="view">The view.</param>
    /// <param name="competitionSlug">What addresses the competition, in any of the languages it is named in.</param>
    /// <returns><inheritdoc cref="SatEntryDto.Cells" path="/summary"/></returns>
    private static IReadOnlyList<ResultCellDto>? CellsIn(HostedCompetitionsViewDto view, string competitionSlug) =>
        // The cells on the entry the reader sat in the one competition under the slug
        Assert.IsType<SatEntryDto>(
                view.Groups
                    .SelectMany(group => group.Competitions)
                    .Single(competition => competition.Slug.Values.Contains(competitionSlug))
                    .Entry)
            .Cells;

    /// <summary>
    /// Sums the scored cells of one row of the results, which is the total the row stands on.
    /// </summary>
    /// <param name="row">The row.</param>
    /// <returns>The sum; null while no cell is scored.</returns>
    private static decimal? TotalOf(ResultRowDto row) =>
        // Nothing scored is no total rather than a 0
        row.Cells.OfType<ScoredCellDto>().Select(cell => cell.Score).ToList() is { Count: > 0 } scores
            ? scores.Sum()
            : null;

    /// <summary>
    /// Finds one student's row of the results.
    /// </summary>
    /// <param name="results">The results.</param>
    /// <param name="username">The student's username.</param>
    /// <returns>Their row.</returns>
    private static ResultRowDto RowOf(CompetitionResultsDto results, string username) =>
        // The one row under the name
        results.Rows.Single(row => row.Student.Username == username);
}
