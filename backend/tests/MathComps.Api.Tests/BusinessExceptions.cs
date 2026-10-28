using MathComps.Api.Extensions;
using MathComps.Infrastructure.Services;

namespace MathComps.Api.Tests;

/// <summary>
/// The business exceptions the services and the endpoints throw, found by reflection so a new one is covered the
/// moment it is declared.
/// </summary>
internal static class BusinessExceptions
{
    /// <summary>
    /// Every <see cref="MathCompsException"/> subclass.
    /// </summary>
    public static readonly Type[] Types =
    [
        // Searched in the Infrastructure assembly, where the services declare theirs, and in the Api one, where the
        // endpoints declare theirs
        .. typeof(MathCompsException).Assembly.GetTypes()
            .Concat(typeof(GlobalExceptionHandler).Assembly.GetTypes())
            .Where(type => type.IsSubclassOf(typeof(MathCompsException))),
    ];

    /// <summary>
    /// The wire code a business exception answers with: its type's name less the "Exception" suffix.
    /// </summary>
    /// <param name="exceptionType">The business exception's type.</param>
    /// <returns>The code.</returns>
    public static string CodeOf(Type exceptionType) => exceptionType.Name[..^nameof(Exception).Length];
}
