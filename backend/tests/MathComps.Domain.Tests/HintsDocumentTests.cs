using MathComps.Domain.EfCoreEntities;

namespace MathComps.Domain.Tests;

/// <summary>
/// Tests the hints document format. The import writes it and the defense engine reads it back, so a drift between
/// the two halves would hand the examiner a ladder with rungs merged or missing.
/// </summary>
public class HintsDocumentTests
{
    /// <summary>
    /// A ladder survives the round trip whole, in order, with a hint's own paragraphs kept together.
    /// </summary>
    [Fact]
    public void A_ladder_survives_the_round_trip()
    {
        // A two-rung ladder whose second rung spans two paragraphs
        string[] hints = ["Try small cases.", "Look at the parity.\n\nIt never changes."];

        // Written and read back
        var read = HintsDocument.Split(HintsDocument.Join(hints));

        // Nothing merged, nothing dropped
        Assert.Equal(hints, read);
    }

    /// <summary>
    /// A ladder with no rungs is no document at all, so a problem without hints gets no text row.
    /// </summary>
    [Fact]
    public void No_hints_is_no_document() =>
        Assert.Null(HintsDocument.Join([]));

    /// <summary>
    /// A document that never got written reads as an empty ladder, which is what the examiner is handed for an
    /// archive problem nobody wrote hints for.
    /// </summary>
    [Fact]
    public void No_document_is_an_empty_ladder() =>
        Assert.Empty(HintsDocument.Split(null));

    /// <summary>
    /// A sentinel is only a sentinel on a line of its own, so one quoted inside a hint's prose stays part of that hint.
    /// </summary>
    [Fact]
    public void A_sentinel_inside_a_line_is_prose()
    {
        // A document whose first hint mentions the sentinel mid-sentence
        var document = $"{HintsDocument.Sentinel}\n\nwrite {HintsDocument.Sentinel} before each\n\n"
            + $"{HintsDocument.Sentinel}\n\nsecond";

        // Read back
        var read = HintsDocument.Split(document);

        // Two hints, the mention intact
        Assert.Equal([$"write {HintsDocument.Sentinel} before each", "second"], read);
    }
}
