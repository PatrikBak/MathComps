using MathComps.Cli.BulkImport.Manifest;
using MathComps.Domain.Localization;

namespace MathComps.Cli.BulkImport.Tests;

/// <summary>
/// Tests how a draft's folder-level metadata reads the instant its round opens.
/// </summary>
public class ManifestMetaTests
{
    /// <summary>
    /// An embargo written with a zone's offset reads as the same instant in UTC. A stored instant carries no offset,
    /// so the import could write nothing else.
    /// </summary>
    [Fact]
    public void An_embargo_written_with_an_offset_reads_as_utc()
    {
        // Metadata holding the round back until 18:00 in Bratislava's summer time.
        var meta = new ManifestMeta(
            "csmo-a-iii", new ManifestSeason(2026), "2026-09-14", "2026-09-14T18:00:00+02:00", Language.SK);

        // The instant the metadata reads.
        var visibleSince = meta.VisibleSinceUtc;

        // The same instant, at offset zero.
        Assert.Equal(new DateTimeOffset(2026, 9, 14, 16, 0, 0, TimeSpan.Zero), visibleSince);
        Assert.Equal(TimeSpan.Zero, visibleSince!.Value.Offset);
    }
}
