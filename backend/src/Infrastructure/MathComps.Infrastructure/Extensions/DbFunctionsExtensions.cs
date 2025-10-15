using Microsoft.EntityFrameworkCore;

namespace MathComps.Infrastructure.Extensions;

/// <summary>
/// Custom PostgreSQL database functions and text normalization utilities.
/// </summary>
public static class PostgresDbFunctions
{
    /// <summary>
    /// Removes accents and diacritics from text using PostgreSQL's unaccent() function.
    /// Translates to: unaccent(text) in the generated SQL.
    /// </summary>
    /// <param name="text">The text to normalize by removing accents.</param>
    /// <returns>Text with all diacritics removed (café → cafe, pôžitok → pozitok).</returns>
    /// <remarks>
    /// This method is translated to SQL by EF Core and should only be used in LINQ queries on database columns.
    /// Requires the 'unaccent' PostgreSQL extension to be enabled in the database.
    /// </remarks>
    [DbFunction("unaccent", "public")]
    public static string Unaccent(string text) =>
        // This method body will never execute; EF Core translates it to SQL.
        throw new NotSupportedException("This method is for use in EF Core queries only.");
}

