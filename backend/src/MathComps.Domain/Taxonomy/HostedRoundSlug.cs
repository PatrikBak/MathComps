namespace MathComps.Domain.Taxonomy;

/// <summary>
/// Builds and reads the slug a hosted competition is addressed by in a URL: the localized name of the node it
/// runs under, and the year its season starts in (<c>pokrocila-1-2026</c>).
/// </summary>
/// <remarks>
/// The node and the season are what a round is unique by, and the slug is a rendering of that key. The year is
/// what tells one season's round from the next: a group node is shared by every season it runs in.
/// </remarks>
public static class HostedRoundSlug
{
    /// <summary>
    /// How many digits the season's year is written with, which is what tells it apart from the node name it
    /// follows.
    /// </summary>
    private const int YearDigits = 4;

    /// <summary>
    /// Builds the slug one round is addressed by in one language.
    /// </summary>
    /// <param name="nodeUrlSlug">What the node the round runs under is called in the language being built for.</param>
    /// <param name="seasonStartYear">The year the round's season starts in.</param>
    /// <returns>The slug.</returns>
    public static string Build(string nodeUrlSlug, int seasonStartYear) =>
        $"{nodeUrlSlug}-{seasonStartYear}";

    /// <summary>
    /// Reads a slug back into the two things it was built from.
    /// </summary>
    /// <remarks>
    /// A node name may itself end in a number (<c>pokrocila-1</c>), so the year is taken as exactly the last
    /// four digits rather than as whatever trails the last dash.
    /// </remarks>
    /// <param name="slug">The slug to read.</param>
    /// <param name="nodeUrlSlug">What the node is called, set only when the slug reads.</param>
    /// <param name="seasonStartYear">The year the season starts in, set only when the slug reads.</param>
    /// <returns>True when the slug is shaped like one this builds, false for anything else.</returns>
    public static bool TryParse(string slug, out string nodeUrlSlug, out int seasonStartYear)
    {
        // Nothing read yet.
        nodeUrlSlug = string.Empty;
        seasonStartYear = 0;

        // Where the year starts, the year being the tail.
        var yearStart = slug.Length - YearDigits;

        // Too short to hold a name, a dash and a year, or not carrying the dash where one has to be.
        if (yearStart < 2 || slug[yearStart - 1] != '-')
            return false;

        // The characters the year would be written in.
        var tail = slug[yearStart..];

        // Characters that are not all digits are not a year, whatever else they are: a parse alone would take a
        // leading sign or space for part of one.
        if (!tail.All(char.IsAsciiDigit))
            return false;

        // Both halves, the dash between them belonging to neither.
        nodeUrlSlug = slug[..(yearStart - 1)];
        seasonStartYear = int.Parse(tail);

        // Read.
        return true;
    }
}
