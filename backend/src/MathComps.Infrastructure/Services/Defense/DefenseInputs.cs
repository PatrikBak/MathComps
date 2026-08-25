using MathComps.Domain.Contracts.Defense;
using MathComps.Infrastructure.Options;

namespace MathComps.Infrastructure.Services.Defense;

/// <summary>
/// The checks a defense turn's inputs pass before they are used to look anything up. Every one of them refuses
/// a request the caller could fix, so none is a server fault.
/// </summary>
internal static class DefenseInputs
{
    /// <summary>
    /// Throws when a required input is missing or blank.
    /// </summary>
    /// <param name="value">The required input to check.</param>
    public static void EnsureNotBlank(string value)
    {
        // Null (a missing JSON field), empty, or whitespace-only is a bad request, not a server fault.
        if (string.IsNullOrWhiteSpace(value))
            throw new DefenseMessageEmptyException();
    }

    /// <summary>
    /// Throws when a value exceeds its length cap.
    /// </summary>
    /// <param name="value">The text to bound.</param>
    /// <param name="maxLength">The most characters allowed.</param>
    public static void EnsureWithinLength(string value, int maxLength)
    {
        // Over the cap is a bad request, not a server error.
        if (value.Length > maxLength)
            throw new DefenseMessageTooLongException();
    }

    /// <summary>
    /// Throws when what is being defended is missing, or when the target the caller sent cannot address anything.
    /// </summary>
    /// <param name="target">The target to check, null when the request omitted it entirely.</param>
    /// <param name="limits">The caps a target's own text is held to.</param>
    public static void EnsureTargetPresent(DefenseTarget? target, DefenseLimits limits)
    {
        // Each arm is addressed by different fields, so each has its own way of naming nothing.
        switch (target)
        {
            // Both halves are needed to locate the environment, so neither may be blank or overlong.
            case HandoutEnvironmentTarget handout:
                EnsureNotBlank(handout.HandoutContentId);
                EnsureNotBlank(handout.EnvironmentId);
                EnsureWithinLength(handout.HandoutContentId, limits.MaxHandoutContentIdChars);
                EnsureWithinLength(handout.EnvironmentId, limits.MaxEnvironmentIdChars);
                break;

            // An empty id addresses no problem, and the binder writes one for a field the request left out.
            case ProblemTarget problem when problem.ProblemId == Guid.Empty:
                throw new DefenseMessageEmptyException();

            // A well-formed problem id needs no bounding: it is a Guid, not text the caller composed.
            case ProblemTarget:
                break;

            // A request that omits the target, or sends a kind nothing here knows, names nothing to defend.
            default:
                throw new DefenseMessageEmptyException();
        }
    }
}
