using System.Text.Json.Serialization;

namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The math-check step's verdict on the examiner's reply: whether the claims it makes hold, whether it ends the
/// examination, and whether the candidate's own turns already make a complete solution.
/// </summary>
/// <remarks>
/// What is still owed precedes whether the solution is complete, so the model lists the missing steps before deciding.
/// The derived flags stay out of the schema the checker fills.
/// </remarks>
/// <param name="Holds">Whether every claim is correct against the reference — true too when the reply makes none.
/// Ending the examination claims nothing, so an ending never fails it.</param>
/// <param name="Correction">Which claim is wrong and the correct statement, when one fails; empty when all hold.</param>
/// <param name="Closes">Whether the reply ends the examination: it has nothing more to ask, or leaves the rest to the
/// candidate.</param>
/// <param name="Owed">What a complete solution still needs that no candidate turn argued; empty when the solution is
/// complete.</param>
/// <param name="Complete">Whether the candidate's own turns already argue everything a complete solution must
/// establish.</param>
public record MathCheckResult(bool Holds, string Correction, bool Closes, string Owed, bool Complete)
{
    /// <summary>
    /// Whether the reply ends the examination while a step is still owed, which tells the candidate they are done
    /// when they aren't.
    /// </summary>
    [JsonIgnore]
    public bool ClosesEarly => Closes && !Complete;

    /// <summary>
    /// Whether the reply keeps the examination going although the candidate's solution is already complete.
    /// </summary>
    [JsonIgnore]
    public bool WithholdsClose => Complete && !Closes;
}
