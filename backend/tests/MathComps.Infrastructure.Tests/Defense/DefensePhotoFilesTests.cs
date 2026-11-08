using MathComps.Infrastructure.Services.Defense;
using MathComps.Infrastructure.Tests.TestInfrastructure;

namespace MathComps.Infrastructure.Tests.Defense;

/// <summary>
/// Tests <see cref="DefensePhotoFiles"/>: a message's pages are linked in page order, each with the drawings cut out of
/// it in the order its reading lists them, every link reaching the file the reading stored.
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
        var links = new DefensePhotoFiles(new StandInFileLinks()).LinksFor([later, earlier]);

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
}
