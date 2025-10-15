namespace MathComps.Cli.SkmoProblems.Rendering;

/// <summary>
/// Different modes of rendering the parsed SKMO problems to HTML files.
/// </summary>
public enum ProblemRenderingMode
{
    /// <summary>
    /// Useful when testing parsing only, no preview rendering is needed then.
    /// </summary>
    NoRendering,

    /// <summary>
    /// Each olympiad year will have its own HTML file. Useful when we want to preview
    /// newly added problems, then we can just open the file for that year.
    /// </summary>
    SplitByYears,

    /// <summary>
    /// Useful when we're just debugging and manually add filters for certain problems
    /// that we want to preview (e.g. problems with images).
    /// </summary>
    AllInOneFile,
}
