namespace MathComps.Cli.SkmoProblems.Rendering;

/// <summary>
/// Configuration for rendering the parsed SKMO problems to HTML files.
/// </summary>
/// <param name="HtmlOutputFolder">The local directory path where the rendered HTML files will be saved.</param>
/// <param name="ProblemRenderingMode">Specifies how the problems should be grouped into output HTML files.</param>
public record ProblemRenderedConfig(
    string HtmlOutputFolder,
    ProblemRenderingMode ProblemRenderingMode
);
