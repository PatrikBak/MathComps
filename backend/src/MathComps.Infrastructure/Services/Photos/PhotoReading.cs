namespace MathComps.Infrastructure.Services.Photos;

/// <summary>
/// What a photo of a handwritten page reads as: its text, the page itself, and the drawings cut out of it.
/// </summary>
/// <param name="Text">The page written out as Markdown with LaTeX math, mistakes included. Its drawings are in
/// <paramref name="Crops"/>.</param>
/// <param name="Page">The page as a JPEG, turned upright and shrunk to fit the configured long edge: the image
/// the model read.</param>
/// <param name="Crops">The drawings cut out of the page, in the order the reading lists them.</param>
public record PhotoReading(string Text, byte[] Page, IReadOnlyList<PhotoCrop> Crops);

/// <summary>
/// One drawing cut out of a page.
/// </summary>
/// <param name="Label">The drawing's name, such as <c>Figure 1</c>.</param>
/// <param name="Image">The drawing as a JPEG, with a margin around the box the model gave it.</param>
public record PhotoCrop(string Label, byte[] Image);
