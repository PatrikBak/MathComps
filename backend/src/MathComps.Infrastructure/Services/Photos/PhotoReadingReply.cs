using System.Text.Json.Serialization;

namespace MathComps.Infrastructure.Services.Photos;

/// <summary>
/// The model's reading of a page, in the shape its reply is bound to.
/// </summary>
/// <param name="Text">The page written out, with a marker where each drawing sits.</param>
/// <param name="Figures">Every drawing on the page; empty when there is none.</param>
internal record PhotoReadingReply(string Text, IReadOnlyList<PhotoReadingFigure> Figures);

/// <summary>
/// One drawing the model found on a page.
/// </summary>
/// <param name="Label">The drawing's marker in the text, such as <c>Figure 1</c>.</param>
/// <param name="Box">Where the drawing sits, as <c>[ymin, xmin, ymax, xmax]</c> in thousandths of the page's height
/// and width. The field is named <c>box_2d</c>, the name Gemini is trained to fill with exactly this, which no naming
/// policy makes of a property name.</param>
internal record PhotoReadingFigure(string Label, [property: JsonPropertyName("box_2d")] IReadOnlyList<int> Box);
