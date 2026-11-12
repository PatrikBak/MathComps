using System.Net.Mime;
using MathComps.Domain.Contracts.Defense;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Options;
using MathComps.Infrastructure.Persistence;
using MathComps.Infrastructure.Services.Ai;
using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Services.Photos;
using MathComps.Infrastructure.Storage;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Integration tests for <see cref="DefensePhotoService"/> against a real PostgreSQL database, with the reader and the
/// target guard standing in and the files kept in memory: what a reading keeps, links and bills, the ceiling it is held
/// to and who an entry exempts, and that a reading the student walked out on is still billed. A reading billed wrong
/// moves the ceiling silently.
/// </summary>
/// <param name="fixture">The shared PostgreSQL container fixture.</param>
public class DefensePhotoServicePostgresTests(PostgresContainerFixture fixture)
    : PostgresTestBase<IDefensePhotoService>(fixture), IDisposable
{
    /// <summary>
    /// The student taking the photos.
    /// </summary>
    private static readonly Guid _ownerId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    /// <summary>
    /// The handout environment every reading is for.
    /// </summary>
    private static readonly HandoutEnvironmentTarget _target = new("handout", "env-1");

    /// <summary>
    /// The photo file every reading is handed, which the stand-in reader never decodes.
    /// </summary>
    private static readonly byte[] _photo = [1, 2, 3];

    /// <summary>
    /// What one reading bills.
    /// </summary>
    private static readonly ModelUsage _readingUsage = new(
        0.008m, PromptTokens: 1_200, CompletionTokens: 300, ReasoningTokens: 40, CachedPromptTokens: 5);

    /// <summary>
    /// What the stand-in reader reads every photo as: a page with two drawings on it.
    /// </summary>
    private static readonly PhotoReading _reading = new(
        "Look at the triangle, then the circle.",
        [10, 11, 12],
        [new PhotoCrop("Figure 1", [20, 21]), new PhotoCrop("Figure 2", [30, 31])]);

    /// <summary>
    /// The stand-in reader, reading every photo as <see cref="_reading"/> unless a test sets it up otherwise.
    /// </summary>
    private readonly Mock<IPhotoReader> _reader = new();

    /// <summary>
    /// The stand-in target guard, letting every target through and finding no entry unless a test sets it up
    /// otherwise.
    /// </summary>
    private readonly Mock<IDefenseTargetGuard> _guard = new();

    /// <summary>
    /// Where the service keeps its files.
    /// </summary>
    private readonly FakePrivateObjectStore _store = new();

    /// <summary>
    /// The request a student walks out on, which a test cancels from inside the reading.
    /// </summary>
    private readonly CancellationTokenSource _walkOut = new();

    /// <inheritdoc/>
    protected override void ConfigureServices(IServiceCollection services)
    {
        // The caps every test runs under.
        services.Configure<DefenseLimits>(limits =>
        {
            // A tight ceiling, so a single seeded row meets it.
            limits.DailySpendCeilingPerUser = 1.00m;

            // Links to every photo a test names.
            limits.MaxPhotoLinksPerRequest = 10;
        });

        // The reader, reading every photo as the same page.
        _reader.Setup(reader => reader.ReadAsync(It.IsAny<ReadOnlyMemory<byte>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ChatCallResult<PhotoReading>(_reading, "test-model", _readingUsage));
        services.AddSingleton(_reader.Object);

        // The guard.
        services.AddSingleton(_guard.Object);

        // Where the files are kept.
        services.AddSingleton<IPrivateObjectStore>(_store);

        // The links to the kept pages, each naming the file it reads.
        services.AddSingleton<IPrivateFileLinks, StandInFileLinks>();

        // The kept files read back.
        services.AddSingleton<IObjectReader>(_store);

        // The photos' files, linked through the stand-in links.
        services.AddSingleton<IDefensePhotoFiles, DefensePhotoFiles>();

        // The service under test.
        services.AddScoped<IDefensePhotoService, DefensePhotoService>();
    }

    /// <inheritdoc/>
    protected override async Task SeedDataAsync(MathCompsDbContext context)
    {
        // The student.
        context.Users.Add(new User { Id = _ownerId, ExternalId = "ext-owner", Username = "Owner" });

        // Commit the seed.
        await context.SaveChangesAsync();
    }

    /// <summary>
    /// A reading answers the page's text, and keeps the page the model read and every drawing under the ids that came
    /// back, in the order the reading lists them.
    /// </summary>
    [Fact]
    public Task A_reading_keeps_the_page_and_each_drawing_under_the_ids_it_answers() =>
        RunTestAsync(async service =>
        {
            // Read a photo.
            var reading = await service.ReadAsync(_ownerId, _target, _photo);

            // The page's text comes back as the reader gave it.
            Assert.Equal(_reading.Text, reading.Text);

            // The drawings come back in the reading's order.
            Assert.Equal(["Figure 1", "Figure 2"], reading.Crops.Select(crop => crop.Label));

            // The keys the rows' ids lead to, the drawings beside their page.
            string[] keys =
            [
                $"defense/photos/{reading.PhotoId}.jpg",
                .. reading.Crops.Select(crop => $"defense/photos/{reading.PhotoId}/crops/{crop.Id}.jpg"),
            ];

            // Every file kept under one of them, and nothing else.
            Assert.Equal(keys.Order(), _store.Keys.Order());

            // The drawings' rows, in the order they are kept in.
            var rows = await QueryValueAsync(context => context.DefensePhotoCrops
                .Where(crop => crop.PhotoId == reading.PhotoId)
                .OrderBy(crop => crop.Position)
                .Select(crop => new { crop.Id, crop.Label, crop.Position })
                .ToListAsync());

            // One for each drawing that came back, with its label and its place in the reading.
            Assert.Equal(
                reading.Crops.Select((crop, position) => (crop.Id, crop.Label, position)),
                rows.Select(row => (row.Id, row.Label, row.Position)));

            // The page kept as the image the model read, and each drawing as its own cut-out.
            Assert.Equal(
                [_reading.Page, .. _reading.Crops.Select(crop => crop.Image)],
                keys.Select(key => _store[key].Content));

            // Every one of them a JPEG.
            Assert.All(keys, key => Assert.Equal(MediaTypeNames.Image.Jpeg, _store[key].ContentType));
        });

    /// <summary>
    /// A reading answers a link to the very page it kept.
    /// </summary>
    [Fact]
    public Task A_reading_answers_a_link_to_the_page_it_kept() => RunTestAsync(async service =>
    {
        // Read a photo.
        var reading = await service.ReadAsync(_ownerId, _target, _photo);

        // The link reads the page kept under the photo's id.
        Assert.Equal($"read:defense/photos/{reading.PhotoId}.jpg", reading.Link);
    });

    /// <summary>
    /// A reading keeps the page's text on the photo's row, exactly as it answers it.
    /// </summary>
    [Fact]
    public Task A_reading_keeps_the_text_it_answers_on_its_photo_row() => RunTestAsync(async service =>
    {
        // Read a photo.
        var reading = await service.ReadAsync(_ownerId, _target, _photo);

        // The text kept on the photo's row.
        var text = await QueryValueAsync(context => context.DefensePhotos
            .Where(photo => photo.Id == reading.PhotoId)
            .Select(photo => photo.Text)
            .SingleAsync());

        // The same text the reading answered.
        Assert.Equal(reading.Text, text);
    });

    /// <summary>
    /// A reading for a handout writes one spend row naming the photo and carrying what the model billed, weighed
    /// against the student's ceiling like a turn.
    /// </summary>
    [Fact]
    public Task A_handout_reading_bills_what_the_model_cost_against_the_ceiling() => RunTestAsync(async service =>
    {
        // Read a photo.
        var reading = await service.ReadAsync(_ownerId, _target, _photo);

        // The one row the reading wrote.
        var spend = Assert.Single(await QueryValueAsync(context => context.DefenseSpends.ToListAsync()));

        // Billed to the student for this photo, as the model billed it, and weighed against the ceiling.
        Assert.Equal(
            (_ownerId, (Guid?)reading.PhotoId, _readingUsage, Revisions: 0, true),
            (spend.UserId,
                spend.PhotoId,
                new ModelUsage(
                    spend.Cost, spend.PromptTokens, spend.CompletionTokens, spend.ReasoningTokens,
                    spend.CachedPromptTokens),
                spend.Revisions,
                spend.CountsAgainstCeiling));
    });

    /// <summary>
    /// A student whose day's allowance is spent is refused before the model is called, so the refusal costs nothing,
    /// and nothing is kept.
    /// </summary>
    [Fact]
    public Task A_reading_past_the_ceiling_is_refused_before_the_model_is_called() => RunTestAsync(async service =>
    {
        // Spend that meets the ceiling.
        await SeedSpendAtCeilingAsync();

        // The reading is refused.
        await Assert.ThrowsAsync<DefenseSpendLimitException>(() => service.ReadAsync(_ownerId, _target, _photo));

        // Before the model was asked anything.
        _reader.Verify(
            reader => reader.ReadAsync(It.IsAny<ReadOnlyMemory<byte>>(), It.IsAny<CancellationToken>()), Times.Never);

        // And with nothing kept.
        Assert.Empty(_store.Keys);
    });

    /// <summary>
    /// A student holding an entry into the round reads past a spent allowance, and the reading is recorded as outside
    /// the ceiling, so a competition never spends what their handout practice is held to.
    /// </summary>
    [Fact]
    public Task An_entrant_reads_past_the_ceiling_and_their_reading_is_not_weighed_against_it() =>
        RunTestAsync(async service =>
        {
            // The student holds an entry into what they defend.
            _guard.Setup(guard => guard.EnsureCanDefendAsync(_ownerId, _target, It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Spend that meets the ceiling, the way a morning on handouts leaves it.
            await SeedSpendAtCeilingAsync();

            // The reading goes ahead all the same.
            await service.ReadAsync(_ownerId, _target, _photo);

            // Billed outside the ceiling.
            Assert.False(await QueryValueAsync(context => context.DefenseSpends
                .Where(spend => spend.Cost == _readingUsage.Cost)
                .Select(spend => spend.CountsAgainstCeiling)
                .SingleAsync()));
        });

    /// <summary>
    /// A student who leaves once the model has answered still has the reading kept and billed, so walking out on a
    /// reading can't dodge the ceiling.
    /// </summary>
    [Fact]
    public Task A_reading_the_student_walked_out_on_is_still_kept_and_billed() => RunTestAsync(async service =>
    {
        // The model answers just as the student leaves.
        _reader.Setup(reader => reader.ReadAsync(It.IsAny<ReadOnlyMemory<byte>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                // The student leaves.
                _walkOut.Cancel();

                // The model's answer.
                return new ChatCallResult<PhotoReading>(_reading, "test-model", _readingUsage);
            });

        // Read a photo.
        await service.ReadAsync(_ownerId, _target, _photo, _walkOut.Token);

        // The page and both drawings kept.
        Assert.Equal(3, _store.Keys.Count);

        // And the reading billed.
        Assert.Equal(1, await QueryValueAsync(context => context.DefenseSpends.CountAsync()));
    });

    /// <summary>
    /// Links go only to the student's own photos that no message carries yet: a photo of someone else's and one the
    /// student already sent are left out. A link to the first hands one student's page to another, and the second is
    /// no longer a draft's to show.
    /// </summary>
    [Fact]
    public Task Links_go_only_to_the_students_own_unsent_photos() => RunTestAsync(async service =>
    {
        // A photo of the student's still to send.
        var unsent = DefenseSeed.NewPhoto(_ownerId, drawings: 0);

        // Another student.
        var otherId = Guid.CreateVersion7();

        // A photo of the other student's.
        var others = DefenseSeed.NewPhoto(otherId, drawings: 0);

        // A photo of the student's that already went out.
        var sent = DefenseSeed.NewPhoto(_ownerId, drawings: 0);

        // The conversation the sent photo went out in, and the message that carried it.
        var sessionId = Guid.CreateVersion7();
        var turnId = Guid.CreateVersion7();

        // The other student, the conversation and every photo, kept.
        await QueryAsync(async context =>
        {
            // The other student.
            context.Users.Add(new User { Id = otherId, ExternalId = "ext-other", Username = "Other" });

            // The student's conversation.
            context.DefenseSessions.Add(new DefenseSession
            {
                Id = sessionId,
                UserId = _ownerId,
                TargetKind = DefenseTargetKind.Handout,
                ProblemStatement = "Statement",
                ProblemReference = "Reference",
                ExaminerConfig = "{}",
                CreatedAt = DateTimeOffset.UtcNow,
            });

            // The message the sent photo went out with.
            context.DefenseTurns.Add(new DefenseTurn
            {
                Id = turnId,
                SessionId = sessionId,
                Role = TranscriptRole.Candidate,
                Content = "my defense",
                Sequence = 0,
                CreatedAt = DateTimeOffset.UtcNow,
            });

            // The sent photo, carried by the student's message.
            sent.TurnId = turnId;
            sent.Position = 0;

            // The photos.
            context.DefensePhotos.AddRange(unsent, others, sent);

            // Commit the seed.
            await context.SaveChangesAsync();
        });

        // Ask for links to every photo kept.
        var links = await service.LinksToUnsentPhotosAsync(_ownerId, [unsent.Id, others.Id, sent.Id]);

        // Only the unsent one of the student's gets one, reading its page.
        Assert.Equal(
            [KeyValuePair.Create(unsent.Id, $"read:defense/photos/{unsent.Id}.jpg")],
            links);
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
    /// Puts the owner's spend for the day exactly on the configured ceiling.
    /// </summary>
    /// <returns>A task that completes once the row is written.</returns>
    private Task SeedSpendAtCeilingAsync() => QueryAsync(async context =>
    {
        // A spend row that meets the ceiling.
        context.DefenseSpends.Add(DefenseSeed.NewSpend(_ownerId, 1.00m, countsAgainstCeiling: true, DateTimeOffset.UtcNow));

        // Commit the seeded spend.
        await context.SaveChangesAsync();
    });
}
