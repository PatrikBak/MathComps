using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Domain.Localization;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Competitions;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Localization;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Infrastructure.Storage;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="DefensePhotoHandoffService"/> against a real PostgreSQL database, the photos read
/// through the real <see cref="DefensePhotoService"/> with the reader and the target guard standing in. The code is the
/// only thing letting a phone in, so these pin who a code reaches: the one live code a student is handed, the problem
/// a page lands under, and that a page reaches its own student's composer exactly once.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefensePhotoHandoffServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefensePhotoHandoffService>(fixture), IDisposable
{
    /// <summary>
    /// The student sending photos from their phone.
    /// </summary>
    private static readonly Guid _ownerId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// Another student, whose pages the owner must never be handed.
    /// </summary>
    private static readonly Guid _otherId = Guid.Parse("00000000-0000-0000-0000-000000000002");

    /// <summary>
    /// The seeded archive problem's id.
    /// </summary>
    private static readonly Guid _problemId = Guid.Parse("00000000-0000-0000-0000-0000000000a1");

    /// <summary>
    /// The archive problem as a defense names it.
    /// </summary>
    private static readonly ProblemTarget _problem = new(_problemId);

    /// <summary>
    /// A handout environment, as a defense names it.
    /// </summary>
    private static readonly HandoutEnvironmentTarget _handout = new("handout", "env-1");

    /// <summary>
    /// A code shaped like a real one that no live handoff has: nobody's at all, or the one
    /// <see cref="SeedExpiredHandoffAsync"/> seeds after it ran out.
    /// </summary>
    private const string ExpiredOrUnknownCode = "0123456789abcdef0123456789abcdef";

    /// <summary>
    /// The photo file every send carries, which the stand-in reader never decodes.
    /// </summary>
    private static readonly byte[] _photo = [1, 2, 3];

    /// <summary>
    /// What the stand-in reader reads every photo as.
    /// </summary>
    private static readonly PhotoReading _reading = new("The triangle is isosceles.", [10, 11], []);

    /// <summary>
    /// The stand-in reader, reading every photo as <see cref="_reading"/> once <see cref="_duringRead"/> has run.
    /// </summary>
    private readonly Mock<IPhotoReader> _reader = new();

    /// <summary>
    /// What runs while a photo is being read, set by a test that acts mid-read.
    /// </summary>
    private Func<Task> _duringRead = () => Task.CompletedTask;

    /// <summary>
    /// The stand-in target guard, letting every target through unless a test sets it up otherwise.
    /// </summary>
    private readonly Mock<IDefenseTargetGuard> _guard = new();

    /// <summary>
    /// Where the photos' files are kept.
    /// </summary>
    private readonly FakePrivateObjectStore _store = new();

    /// <summary>
    /// The request a phone walks out on, which a test cancels from inside the reading.
    /// </summary>
    private readonly CancellationTokenSource _walkOut = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // A ceiling no test comes near.
        services.Configure<DefenseLimits>(limits => limits.DailySpendCeilingPerUser = 100m);

        // Codes that work for eight hours.
        services.Configure<DefensePhotoHandoffSettings>(settings => settings.CodeLifetime = TimeSpan.FromHours(8));

        // The reader, running whatever a test does mid-read, then reading every photo as the same page.
        _reader.Setup(reader => reader.ReadAsync(It.IsAny<ReadOnlyMemory<byte>>(), It.IsAny<CancellationToken>()))
            .Returns(async (ReadOnlyMemory<byte> _, CancellationToken _) =>
            {
                // Whatever the test does while the photo is read
                await _duringRead();

                // The page as read
                return new ChatCallResult<PhotoReading>(_reading, "test-model", ModelUsage.Zero);
            });

        // Registered for the reading.
        services.AddSingleton(_reader.Object);

        // The guard.
        services.AddSingleton(_guard.Object);

        // Where the files are kept and read back from.
        services.AddSingleton<IPrivateObjectStore>(_store);
        services.AddSingleton<IObjectReader>(_store);

        // Links to the kept files, each naming the file it reaches.
        services.AddSingleton<IPrivateFileLinks, StandInFileLinks>();

        // The photos' files: the links to them.
        services.AddSingleton<IDefensePhotoFiles, DefensePhotoFiles>();

        // The display names a competition problem is listed under.
        services.AddSingleton<IMetadataLocalizationService, MetadataLocalizationService>();

        // The reading every send goes through.
        services.AddScoped<IDefensePhotoService, DefensePhotoService>();

        // The service under test.
        services.AddScoped<IDefensePhotoHandoffService, DefensePhotoHandoffService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // Two students, so one's pages can be kept from the other.
        context.Users.AddRange(
            new User { Id = _ownerId, ExternalId = "ext-owner", Username = "Owner" },
            new User { Id = _otherId, ExternalId = "ext-other", Username = "Other" });

        // One archive problem, which a code can point at as well as a handout, built from its season up.

        // The season the round sits in.
        var season = new Season { Id = Guid.NewGuid(), StartYear = 2026, EditionNumber = 76 };
        context.Seasons.Add(season);

        // The root the competition node hangs off.
        CompetitionTreeSeed.Root(context, "mathcomps", 100);

        // The round the problem was set in.
        var round = new Round
        {
            Id = Guid.CreateVersion7(),
            CompetitionId = CompetitionTreeSeed.Chain(context, "mathcomps-advanced-september").Id,
            SeasonId = season.Id,
            Date = new DateOnly(2026, 10, 1),
        };
        context.Rounds.Add(round);

        // And the problem itself.
        context.Problems.Add(new Problem
        {
            Id = _problemId,
            RoundId = round.Id,
            Number = 1,
            Slug = "mathcomps-advanced-september",
        });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A live code finds the student it belongs to, never another student who has a code of their own.
    /// </summary>
    [Fact]
    public Task A_live_code_finds_its_own_student() =>
        RunTestAsync(async service =>
    {
        // A code for the owner
        var owners = await service.PointAsync(_ownerId, _handout);

        // And one for the other student
        var others = await service.PointAsync(_otherId, _handout);

        // The owner's code finds the owner
        Assert.Equal("ext-owner", await service.FindStudentAsync(owners.Code));

        // And the other student's finds them
        Assert.Equal("ext-other", await service.FindStudentAsync(others.Code));
    });

    /// <summary>
    /// Asking again hands back the code the student already has, so the QR their phone scanned keeps working, and
    /// moves it to the new problem, from a handout environment to an archive problem without keeping both.
    /// </summary>
    [Fact]
    public Task A_second_point_hands_back_the_live_code_moved_to_the_new_problem() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the handout
        var first = await service.PointAsync(_ownerId, _handout);

        // The code sends photos to the handout
        Assert.Equal(
            new NamedHandoutTarget(_handout.HandoutContentId, _handout.EnvironmentId),
            (await service.CheckAsync(first.Code, Language.EN)).Target);

        // Ask again, on the problem
        var second = await service.PointAsync(_ownerId, _problem);

        // The same code, still running out when it first would
        Assert.Equal(first, second);

        // Where the code sends photos now
        var check = await service.CheckAsync(second.Code, Language.EN);

        // The problem
        Assert.Equal(_problemId, Assert.IsType<NamedProblemTarget>(check.Target).ProblemId);

        // And the handoff holds the problem alone
        await QueryAsync(async context =>
        {
            // The student's handoff row
            var row = await context.DefensePhotoHandoffs.SingleAsync();

            // The row's handout arm is cleared
            Assert.Null(row.HandoutEnvironmentId);
        });
    });

    /// <summary>
    /// A code that has run out is replaced on the next ask, and the old one opens nothing any more.
    /// </summary>
    [Fact]
    public Task An_expired_code_is_replaced_and_the_old_one_refused() =>
        RunTestAsync(async service =>
    {
        // A code that ran out an hour ago
        await SeedExpiredHandoffAsync();

        // Ask for a code
        var code = await service.PointAsync(_ownerId, _handout);

        // A new code
        Assert.NotEqual(ExpiredOrUnknownCode, code.Code);

        // Working for hours yet
        Assert.True(code.ExpiresAt > DateTimeOffset.UtcNow.AddHours(7));

        // The old code is refused
        await Assert.ThrowsAsync<DefensePhotoHandoffNotFoundException>(
            () => service.CheckAsync(ExpiredOrUnknownCode, Language.EN));
    });

    /// <summary>
    /// Asks racing each other, from a student with no handoff yet or with one whose code has run out, all hand back
    /// one code, so no tab shows a QR another tab's ask has already replaced.
    /// </summary>
    /// <param name="startsExpired">Whether the student starts with a code that has run out, rather than none.</param>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public Task Racing_points_hand_back_one_code(bool startsExpired) =>
        RunTestAsync(async service =>
    {
        // The handoff the student starts with, if any
        if (startsExpired)
            await SeedExpiredHandoffAsync();

        // Ten asks at once
        var codes = await Task.WhenAll(
            Enumerable.Range(0, 10).Select(_ => service.PointAsync(_ownerId, _handout)));

        // One code among them
        var code = Assert.Single(codes.Distinct());

        // And the code works
        await service.CheckAsync(code.Code, Language.EN);
    });

    /// <summary>
    /// A target the student may not argue gets no code, so nothing ever names it to a phone.
    /// </summary>
    [Fact]
    public Task A_refused_target_makes_no_code() =>
        RunTestAsync(async service =>
    {
        // The guard refuses the problem
        _guard.Setup(guard => guard.EnsureCanDefendAsync(_ownerId, _problem, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HostedProblemNotFoundException());

        // Asking for a code on the problem is refused
        await Assert.ThrowsAsync<HostedProblemNotFoundException>(() => service.PointAsync(_ownerId, _problem));

        // And no handoff was made
        await QueryAsync(async context => Assert.False(await context.DefensePhotoHandoffs.AnyAsync()));
    });

    /// <summary>
    /// A request naming no target is refused as a malformed one, on every call the composer names a target in.
    /// </summary>
    [Fact]
    public Task A_request_naming_no_target_is_refused() =>
        RunTestAsync(async service =>
    {
        // Asking for a code on nothing is refused
        await Assert.ThrowsAsync<DefenseMessageEmptyException>(() => service.PointAsync(_ownerId, null!));

        // And so is taking pages for nothing
        await Assert.ThrowsAsync<DefenseMessageEmptyException>(() => service.TakeAsync(_ownerId, null!));
    });

    /// <summary>
    /// A photo sent by a code is weighed by the guard as the code's student arguing the code's problem, so a phone
    /// can send nothing its student couldn't, and a refused reading keeps no page.
    /// </summary>
    [Fact]
    public Task A_send_is_held_to_the_guard_as_the_codes_student() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the problem
        var code = await service.PointAsync(_ownerId, _problem);

        // The guard then refuses the student the problem, as when the competition's embargo starts to apply
        _guard.Setup(guard => guard.EnsureCanDefendAsync(_ownerId, _problem, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HostedEntryRequiredException());

        // Sending a photo by the code is refused
        await Assert.ThrowsAsync<HostedEntryRequiredException>(() => SendAsync(service, code.Code));

        // Before the model was asked
        _reader.VerifyNoOtherCalls();

        // And with no page waiting
        await QueryAsync(async context => Assert.False(await context.DefensePhotoHandoffPages.AnyAsync()));
    });

    /// <summary>
    /// A phone that leaves while its photo is read, its screen locked or its camera opened, still has the page reach
    /// the composer, since the reading is paid for by then.
    /// </summary>
    [Fact]
    public Task A_page_the_phone_walked_out_on_still_waits() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the handout
        var code = await service.PointAsync(_ownerId, _handout);

        // The phone's request, given up while the photo is read
        _duringRead = _walkOut.CancelAsync;

        // The photo file the phone sends
        using var photo = new MemoryStream(_photo);

        // Send the photo on the phone's request
        await service.SendAsync(code.Code, DateTimeOffset.UtcNow, photo, Language.EN, _walkOut.Token);

        // The page waits for the composer all the same
        Assert.Single((await service.TakeAsync(_ownerId, _handout)).Pages);
    });

    /// <summary>
    /// A page goes to the problem the code pointed at when its send started, even when the student moves the code
    /// while the photo is still being read, and the send says which problem that was.
    /// </summary>
    [Fact]
    public Task A_page_goes_to_the_problem_its_code_named_when_the_send_started() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the problem
        var code = await service.PointAsync(_ownerId, _problem);

        // The code, moved to the handout while the photo is read
        _duringRead = () => service.PointAsync(_ownerId, _handout);

        // Send a photo
        var sent = await SendAsync(service, code.Code);

        // The send says the page went to the problem
        Assert.Equal(_problemId, Assert.IsType<NamedProblemTarget>(sent.Target).ProblemId);

        // Nothing waits under the handout
        Assert.Empty((await service.TakeAsync(_ownerId, _handout)).Pages);

        // The page waits under the problem
        Assert.Equal(
            [sent.Reading.PhotoId],
            (await service.TakeAsync(_ownerId, _problem)).Pages.Select(page => page.PhotoId));
    });

    /// <summary>
    /// A page is handed to one composer only, even when ten ask at once, and comes with its text, its capture time
    /// and a link to its photo. The photo is the code's student's own and no message carries it yet, so their next
    /// message can.
    /// </summary>
    [Fact]
    public Task Pages_are_taken_once() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the handout
        var code = await service.PointAsync(_ownerId, _handout);

        // The capture time the phone gives, in its own offset
        var capturedAt = new DateTimeOffset(2026, 11, 9, 14, 30, 0, TimeSpan.FromHours(1));

        // Send a photo
        var sent = await SendAsync(service, code.Code, capturedAt);

        // Ten composers on the handout ask at once
        var takes = await Task.WhenAll(
            Enumerable.Range(0, 10).Select(_ => service.TakeAsync(_ownerId, _handout)));

        // One of the composers got the page
        var page = Assert.Single(takes.SelectMany(take => take.Pages));

        // With its text, its capture time and the link to its photo
        Assert.Equal(
            new DefensePhotoHandoffPageDto(
                sent.Reading.PhotoId, _reading.Text, capturedAt, $"read:defense/photos/{sent.Reading.PhotoId}.jpg"),
            page);

        // The next ask
        var next = await service.TakeAsync(_ownerId, _handout);

        // Finds nothing
        Assert.Empty(next.Pages);

        // While the code still works
        Assert.True(next.HasLiveCode);

        // The photo is the student's, and no message carries it yet
        await QueryAsync(async context =>
        {
            // The kept photo
            var photo = await context.DefensePhotos.SingleAsync();

            // Read as the code's student
            Assert.Equal(_ownerId, photo.UserId);

            // Free to go out with a message
            Assert.Null(photo.TurnId);
        });
    });

    /// <summary>
    /// A page sent while a composer takes the pages before it is not marked taken with them, so the composer's next
    /// ask hands it over rather than nobody ever seeing it.
    /// </summary>
    [Fact]
    public async Task A_page_sent_during_a_take_comes_with_the_next()
    {
        // The id of the page the phone sends once the take has read what waits
        var lateId = Guid.CreateVersion7();

        // The late page's send, run right after the take reads the waiting pages, on a connection of its own
        var sendLate = new AfterQueryInterceptor(
            () => QueryAsync(async context =>
            {
                // The photo the phone sent
                context.DefensePhotos.Add(new DefensePhoto
                {
                    Id = lateId,
                    UserId = _ownerId,
                    Text = _reading.Text,
                    CreatedAt = DateTimeOffset.UtcNow,
                });

                // The page, waiting for the problem's composer
                context.DefensePhotoHandoffPages.Add(new DefensePhotoHandoffPage
                {
                    PhotoId = lateId,
                    ProblemId = _problemId,
                    CapturedAt = DateTimeOffset.UtcNow,
                });

                // Commit the photo and its page while the take still runs
                await context.SaveChangesAsync();
            }),
            "defense_photo_handoff_pages",
            "ORDER BY");

        // The service, its database calls passing through the late page's send
        await RunTestAsync(
            async service =>
            {
                // A code pointed at the problem
                var code = await service.PointAsync(_ownerId, _problem);

                // Send a photo by the code
                var sent = await SendAsync(service, code.Code);

                // A take, during which the late page arrives, hands over the first page alone
                Assert.Equal(
                    [sent.Reading.PhotoId],
                    (await service.TakeAsync(_ownerId, _problem)).Pages.Select(page => page.PhotoId));

                // And the next one hands over the late page
                Assert.Equal(
                    [lateId],
                    (await service.TakeAsync(_ownerId, _problem)).Pages.Select(page => page.PhotoId));
            },
            services => services.ConfigureDbContext<MathCompsDbContext>(
                options => options.AddInterceptors(sendLate)));
    }

    /// <summary>
    /// A page sent to a handout environment comes to that environment's composer alone, never to another handout's
    /// environment of the same id, nor to another environment of the same handout.
    /// </summary>
    [Fact]
    public Task A_page_comes_only_to_the_handout_environment_it_was_sent_to() =>
        RunTestAsync(async service =>
    {
        // A code pointed at the handout
        var code = await service.PointAsync(_ownerId, _handout);

        // Send a photo by the code
        var sent = await SendAsync(service, code.Code);

        // Another handout's environment of the same id
        var otherHandout = new HandoutEnvironmentTarget("other-handout", _handout.EnvironmentId);

        // Finds nothing
        Assert.Empty((await service.TakeAsync(_ownerId, otherHandout)).Pages);

        // Another environment of the same handout
        var otherEnvironment = new HandoutEnvironmentTarget(_handout.HandoutContentId, "env-2");

        // Finds nothing either
        Assert.Empty((await service.TakeAsync(_ownerId, otherEnvironment)).Pages);

        // The environment the page was sent to finds it
        Assert.Equal(
            [sent.Reading.PhotoId],
            (await service.TakeAsync(_ownerId, _handout)).Pages.Select(page => page.PhotoId));
    });

    /// <summary>
    /// A student's composer is never handed another student's pages, even on the problem those pages were sent to.
    /// </summary>
    [Fact]
    public Task Another_students_pages_never_come() =>
        RunTestAsync(async service =>
    {
        // The other student's code, pointed at the problem
        var code = await service.PointAsync(_otherId, _problem);

        // A photo sent by the other student's code
        var sent = await SendAsync(service, code.Code);

        // The owner's composer on the problem finds nothing
        Assert.Empty((await service.TakeAsync(_ownerId, _problem)).Pages);

        // The other student's finds their page
        Assert.Equal(
            [sent.Reading.PhotoId],
            (await service.TakeAsync(_otherId, _problem)).Pages.Select(page => page.PhotoId));
    });

    /// <summary>
    /// A code no handoff has, or one that has run out, opens nothing: it names no problem, and a photo sent by it is
    /// never read off the request, let alone handed to the model.
    /// </summary>
    /// <param name="expired">Whether the code belonged to a handoff that ran out, rather than to none.</param>
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public Task An_unknown_or_expired_code_opens_nothing(bool expired) =>
        RunTestAsync(async service =>
    {
        // The handoff the code belonged to, if any
        if (expired)
            await SeedExpiredHandoffAsync();

        // Checking the code is refused
        await Assert.ThrowsAsync<DefensePhotoHandoffNotFoundException>(
            () => service.CheckAsync(ExpiredOrUnknownCode, Language.EN));

        // The photo a phone sends by the code
        using var photo = new MemoryStream(_photo);

        // Sending the photo is refused
        await Assert.ThrowsAsync<DefensePhotoHandoffNotFoundException>(
            () => service.SendAsync(ExpiredOrUnknownCode, DateTimeOffset.UtcNow, photo, Language.EN));

        // Without a byte read
        Assert.Equal(0, photo.Position);

        // And without the model being asked
        _reader.VerifyNoOtherCalls();

        // And the student is told no code of theirs works
        Assert.False((await service.TakeAsync(_ownerId, _handout)).HasLiveCode);

        // And the code names no student
        Assert.Null(await service.FindStudentAsync(ExpiredOrUnknownCode));
    });

    /// <inheritdoc/>
    public void Dispose()
    {
        // Drop the source a walk-out test cancelled.
        _walkOut.Dispose();

        // No finalizer to run.
        GC.SuppressFinalize(this);
    }

    /// <summary>
    /// Seeds the owner a handoff whose code, <see cref="ExpiredOrUnknownCode"/>, ran out an hour ago, pointed at the
    /// problem.
    /// </summary>
    /// <returns>A task that completes once the handoff is committed.</returns>
    private Task SeedExpiredHandoffAsync() =>
        // The handoff, committed
        QueryAsync(async context =>
        {
            // The handoff
            context.DefensePhotoHandoffs.Add(new DefensePhotoHandoff
            {
                UserId = _ownerId,
                Code = ExpiredOrUnknownCode,
                ExpiresAt = DateTimeOffset.UtcNow.AddHours(-1),
                ProblemId = _problemId,
            });

            // Commit the handoff
            await context.SaveChangesAsync();
        });

    /// <summary>
    /// Sends <see cref="_photo"/> by a code.
    /// </summary>
    /// <param name="service">The service under test.</param>
    /// <param name="code">The code the phone holds.</param>
    /// <param name="capturedAt">When the phone says the photo was taken, now when left out.</param>
    /// <returns>The reading and the problem the page went to.</returns>
    private static async Task<DefensePhotoHandoffReadingDto> SendAsync(
        IDefensePhotoHandoffService service, string code, DateTimeOffset? capturedAt = null)
    {
        // The photo file the phone sends
        using var photo = new MemoryStream(_photo);

        // Send the photo by the code
        return await service.SendAsync(code, capturedAt ?? DateTimeOffset.UtcNow, photo, Language.EN);
    }
}
