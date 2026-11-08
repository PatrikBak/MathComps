using MathComps.Cli.Examiner.Fixtures;
using MathComps.Domain.EfCoreEntities;
using MathComps.Infrastructure.Imaging;
using MathComps.Infrastructure.Services.Defense;
using SkiaSharp;

namespace MathComps.Cli.Examiner.Tests;

/// <summary>
/// Tests loading a fixture folder: each of the three files maps to its own field, a missing required file is named
/// rather than surfacing an opaque I/O error, and crop lines become the candidate's drawings, refused when missing or
/// not a JPEG. Appending a reply keeps the crop lines in the file.
/// </summary>
public class FixtureTests
{
    /// <summary>
    /// Loading maps each file to its field — problem.md to Problem, reference.md to Reference, transcript.md parsed
    /// into turns — checked against sentinel content so the mapping can't ride on any particular fixture's prose and a
    /// problem/reference swap would surface here.
    /// </summary>
    [Fact]
    public async Task LoadAsync_maps_each_file_to_its_field()
    {
        // A throwaway fixture with distinguishable content in each of the three files.
        var folder = Directory.CreateTempSubdirectory("examiner-fixture-tests");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "problem.md"), "the problem");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "reference.md"), "the reference");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "transcript.md"), "## Candidate\n\nmy defense");

        // Load it under a cleanup guard.
        try
        {
            // Load the fixture.
            var fixture = await Fixture.LoadAsync(folder.FullName);

            // The problem file landed in the problem field.
            Assert.Equal("the problem", fixture.Problem);

            // The reference file landed in the reference field — not swapped with the problem.
            Assert.Equal("the reference", fixture.Reference);

            // The transcript markdown parsed into its single candidate turn.
            var turn = Assert.Single(fixture.Transcript.Turns);
            Assert.Equal(new TranscriptTurn(TranscriptRole.Candidate, "my defense", Crops: []), turn);
        }
        finally
        {
            // Clean up the temp folder.
            folder.Delete(recursive: true);
        }
    }

    /// <summary>
    /// A folder missing a required file fails with a message naming that file rather than an opaque I/O error.
    /// </summary>
    [Fact]
    public async Task LoadAsync_names_a_missing_required_file()
    {
        // An empty folder — no problem.md, no anything.
        var emptyFolder = Directory.CreateTempSubdirectory("examiner-fixture-tests");

        // Load it under a cleanup guard.
        try
        {
            // Loading throws for the first required file it can't find.
            var exception = await Assert.ThrowsAsync<FileNotFoundException>(
                () => Fixture.LoadAsync(emptyFolder.FullName));

            // The error names that file.
            Assert.Contains("problem.md", exception.Message);
        }
        finally
        {
            // Clean up the temp folder.
            emptyFolder.Delete(recursive: true);
        }
    }

    /// <summary>
    /// A candidate turn's crop lines come out of its text and back as its drawings, in the order written, wherever
    /// in the turn they sit and whatever their brackets hold. The paragraphs around a crop line close up to one blank
    /// line between them.
    /// </summary>
    [Fact]
    public async Task LoadAsync_turns_crop_lines_into_the_turns_drawings()
    {
        // A candidate turn with one crop line between paragraphs and one closing it, then an examiner turn.
        const string transcript = """
            ## Candidate

            see the first page

            ![Figure 1](crops/one.jpg)

            and the second
            ![](crops/two.jpg)

            ## Examiner

            why?
            """;

        // Load the fixture with both drawings in place.
        await WithFixtureAsync(transcript, async folder =>
        {
            // Two blank pictures told apart by their width.
            using var narrow = new SKBitmap(1, 1);
            using var wide = new SKBitmap(2, 1);

            // Each one as a JPEG.
            var one = RasterImages.EncodeJpeg(narrow, narrow.Info.Rect, quality: 90);
            var two = RasterImages.EncodeJpeg(wide, wide.Info.Rect, quality: 90);

            // Write both where the crop lines point.
            await WriteCropAsync(folder, "one.jpg", one);
            await WriteCropAsync(folder, "two.jpg", two);

            // Load the fixture.
            var fixture = await Fixture.LoadAsync(folder);

            // The loaded candidate turn.
            var candidate = fixture.Transcript.Turns[0];

            // The candidate turn's text holds its paragraphs and no crop line.
            Assert.Equal("see the first page\n\nand the second", candidate.Text);

            // The turn's drawings are the files' bytes, in the order the lines were written.
            Assert.Equal(2, candidate.Crops.Length);
            Assert.Equal(one, candidate.Crops[0]);
            Assert.Equal(two, candidate.Crops[1]);

            // The examiner turn sent no drawing.
            Assert.Empty(fixture.Transcript.Turns[1].Crops);
        });
    }

    /// <summary>
    /// A crop line naming a file that isn't there fails with a missing-file error carrying that file's path, even when
    /// the folder the line points into is missing too.
    /// </summary>
    [Fact]
    public async Task LoadAsync_refuses_a_missing_drawing()
    {
        // A candidate turn naming a drawing nobody wrote.
        await WithFixtureAsync("## Candidate\n\nsee [Figure 1]\n\n![Figure 1](crops/one.jpg)", async folder =>
        {
            // Loading throws for the missing file.
            var exception = await Assert.ThrowsAsync<FileNotFoundException>(() => Fixture.LoadAsync(folder));

            // The error carries that file's path.
            Assert.Equal(Path.Combine(folder, "crops/one.jpg"), exception.FileName);
        });
    }

    /// <summary>
    /// A drawing that isn't a JPEG is refused, since every drawing goes to the model labelled as one.
    /// </summary>
    [Fact]
    public async Task LoadAsync_refuses_a_drawing_that_is_not_a_jpeg()
    {
        // A candidate turn naming a drawing saved as a PNG under a JPEG's name.
        await WithFixtureAsync("## Candidate\n\nsee [Figure 1]\n\n![Figure 1](crops/one.jpg)", async folder =>
        {
            // Write the PNG signature's opening bytes under the drawing's name.
            await WriteCropAsync(folder, "one.jpg", [0x89, 0x50, 0x4E, 0x47]);

            // Loading refuses the drawing.
            await Assert.ThrowsAsync<InvalidDataException>(() => Fixture.LoadAsync(folder));
        });
    }

    /// <summary>
    /// Appending a reply rewrites the transcript file with the reply last and every crop line where it was written,
    /// so the next turn still loads the candidate's drawings.
    /// </summary>
    [Fact]
    public async Task AppendReplyAsync_keeps_the_crop_lines()
    {
        // A candidate turn with a crop line.
        await WithFixtureAsync("## Candidate\n\nsee [Figure 1]\n\n![Figure 1](crops/one.jpg)\n", async folder =>
        {
            // Append the examiner's reply.
            await Fixture.AppendReplyAsync(folder, "a question");

            // The file as written back.
            var written = await File.ReadAllTextAsync(Path.Combine(folder, "transcript.md"));

            // The file holds the crop line and then the reply, ending on a newline.
            Assert.Equal(
                "## Candidate\n\nsee [Figure 1]\n\n![Figure 1](crops/one.jpg)\n\n## Examiner\n\na question\n", written);
        });
    }

    /// <summary>
    /// Writes a throwaway fixture folder holding a problem, a reference and the given transcript, runs the body
    /// against it, and deletes it.
    /// </summary>
    /// <param name="transcript">The transcript markdown.</param>
    /// <param name="body">The work to run against the folder's path.</param>
    private static async Task WithFixtureAsync(string transcript, Func<string, Task> body)
    {
        // The fixture folder with its three files.
        var folder = Directory.CreateTempSubdirectory("examiner-fixture-tests");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "problem.md"), "the problem");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "reference.md"), "the reference");
        await File.WriteAllTextAsync(Path.Combine(folder.FullName, "transcript.md"), transcript);

        // Run the body under a cleanup guard.
        try
        {
            await body(folder.FullName);
        }
        finally
        {
            // Clean up the temp folder.
            folder.Delete(recursive: true);
        }
    }

    /// <summary>
    /// Writes a drawing into a fixture's <c>crops</c> folder.
    /// </summary>
    /// <param name="folder">The fixture folder.</param>
    /// <param name="fileName">The drawing's file name.</param>
    /// <param name="bytes">The drawing's bytes.</param>
    private static async Task WriteCropAsync(string folder, string fileName, byte[] bytes)
    {
        // The folder the crop lines point into.
        var crops = Directory.CreateDirectory(Path.Combine(folder, "crops"));

        // The drawing itself.
        await File.WriteAllBytesAsync(Path.Combine(crops.FullName, fileName), bytes);
    }
}
