using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests <see cref="DefensePhotoFiles"/>: a message's pages are linked in page order, each with the drawings cut out of
/// it in the order its reading lists them, every link reaching the file the reading stored, and the drawings are read
/// back in that same order, one that can't be read keeping its place empty.
/// </summary>
public class DefensePhotoFilesTests
{
    /// <summary>
    /// The pages come in the order they were sent and each page's drawings in the order its reading lists them,
    /// whatever order the photos and drawings are handed over in.
    /// </summary>
    [Fact]
    public void A_message_links_its_pages_and_their_drawings_in_order()
    {
        // A page sent second, with two drawings
        var later = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 2);
        later.Position = 1;

        // The later page's drawings, read the other way round from how they were cut
        later.Crops.First().Position = 1;
        later.Crops.Last().Position = 0;

        // A page sent first, with no drawing
        var earlier = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 0);
        earlier.Position = 0;

        // Link the message's pages, handed over with the later one first
        var links = new DefensePhotoFiles(
                new StandInFileLinks(), new FakePrivateObjectStore(), NullLogger<DefensePhotoFiles>.Instance)
            .LinksFor([later, earlier]);

        // The pages in the order sent, each linked to its own file
        Assert.Equal(
            [(earlier.Id, $"read:defense/photos/{earlier.Id}.jpg"), (later.Id, $"read:defense/photos/{later.Id}.jpg")],
            links.Select(photo => (photo.Id, photo.Link)));

        // The later page's drawings in the order read, each linked to its own file beside the page
        Assert.Equal(
            [
                (later.Crops.Last().Id, $"read:defense/photos/{later.Id}/crops/{later.Crops.Last().Id}.jpg"),
                (later.Crops.First().Id, $"read:defense/photos/{later.Id}/crops/{later.Crops.First().Id}.jpg"),
            ],
            links[1].Crops.Select(crop => (crop.Id, crop.Link)));
    }

    /// <summary>
    /// The drawings come back as their files in the order their links are listed: the pages in the order sent, each
    /// page's drawings in the order its reading lists them.
    /// </summary>
    [Fact]
    public async Task A_message_reads_its_drawings_in_reading_order()
    {
        // A page sent second, with two drawings
        var later = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 2);
        later.Position = 1;

        // The later page's drawings, read the other way round from how they were cut
        later.Crops.First().Position = 1;
        later.Crops.Last().Position = 0;

        // A page sent first, with one drawing
        var earlier = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 1);
        earlier.Position = 0;

        // The private store
        var store = new FakePrivateObjectStore();

        // Keep each drawing's file in the store
        await DefenseSeed.StoreCropFilesAsync(store, [earlier, later]);

        // Read the message's drawings, handed over with the later page first
        var crops = await new DefensePhotoFiles(new StandInFileLinks(), store, NullLogger<DefensePhotoFiles>.Instance)
            .ReadCropsAsync([later, earlier], CancellationToken.None);

        // The first page's drawing, then the second page's in the order read
        Assert.Equal(
            [earlier.Crops.Single().Id, later.Crops.Last().Id, later.Crops.First().Id],
            crops.Select(crop => new Guid(crop!)));
    }

    /// <summary>
    /// A drawing that can't be read, its file gone or the read failing, keeps its place empty while the message's
    /// other drawings are read all the same, and each one lost is logged as an error naming the key it is kept under.
    /// </summary>
    [Fact]
    public async Task A_drawing_that_cant_be_read_keeps_its_place_empty()
    {
        // A page sent first, with one drawing whose file is gone
        var earlier = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 1);
        earlier.Position = 0;

        // A page sent second, with two drawings
        var later = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 2);
        later.Position = 1;

        // The private store
        var store = new FakePrivateObjectStore();

        // Keep the second page's drawings' files alone in the store
        await DefenseSeed.StoreCropFilesAsync(store, [later]);

        // The key of the drawing with no file
        var missingKey = $"defense/photos/{earlier.Id}/crops/{earlier.Crops.Single().Id}.jpg";

        // The key of the second page's first drawing, whose read fails
        var failingKey = $"defense/photos/{later.Id}/crops/{later.Crops.First().Id}.jpg";

        // What the reads log
        var logger = new RecordingLogger<DefensePhotoFiles>();

        // Read the message's drawings
        var crops = await new DefensePhotoFiles(
                new StandInFileLinks(), new FailingObjectReader(store, failingKey), logger)
            .ReadCropsAsync([earlier, later], CancellationToken.None);

        // Both lost drawings' places empty, and the last drawing read all the same
        Assert.Equal(
            [null, null, later.Crops.Last().Id],
            crops.Select(crop => crop is null ? (Guid?)null : new Guid(crop)));

        // An error for each drawing lost, naming its key, the failed read's carrying what broke it
        Assert.Equal(
            new Dictionary<string, (LogLevel, Type?)>
            {
                [missingKey] = (LogLevel.Error, null),
                [failingKey] = (LogLevel.Error, typeof(HttpRequestException)),
            },
            logger.Entries.ToDictionary(
                entry => (string)entry.Values["Key"]!, entry => (entry.Level, entry.Exception?.GetType())));
    }

    /// <summary>
    /// A read the caller cancels stops with the cancellation instead of leaving the drawings' places empty, and logs
    /// nothing, since no drawing was lost.
    /// </summary>
    [Fact]
    public async Task A_cancelled_read_throws_and_logs_nothing()
    {
        // A page with one drawing
        var page = DefenseSeed.NewPhoto(Guid.CreateVersion7(), drawings: 1);

        // The private store
        var store = new FakePrivateObjectStore();

        // Keep the drawing's file in the store
        await DefenseSeed.StoreCropFilesAsync(store, [page]);

        // The caller's cancellation
        using var cancellation = new CancellationTokenSource();

        // Cancel before the read starts
        await cancellation.CancelAsync();

        // What the read logs
        var logger = new RecordingLogger<DefensePhotoFiles>();

        // Read the message's drawing under the cancelled token
        var read = new DefensePhotoFiles(new StandInFileLinks(), store, logger)
            .ReadCropsAsync([page], cancellation.Token);

        // The read stops with the cancellation
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => read);

        // Nothing is logged
        Assert.Empty(logger.Entries);
    }
}
