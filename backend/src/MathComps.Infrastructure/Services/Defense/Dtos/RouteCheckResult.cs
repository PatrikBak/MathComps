namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The route-check step's verdict on whether the reply examines the argument the candidate brought or walks them
/// through the examiner's own.
/// </summary>
/// <remarks>
/// The evidence fields precede the verdict so the model writes its quotes before deciding.
/// </remarks>
/// <param name="Work">The candidate's own work in a sentence, in their terms: their opening plus whatever they
/// volunteered later, never an answer that only filled in what the examiner asked. Empty when they have brought
/// nothing yet.</param>
/// <param name="Taken">Quoted parts of the candidate's work retained in the reply's question, excluding details
/// already in the problem statement; empty when none remain.</param>
/// <param name="Restates">
/// <inheritdoc cref="Domain.EfCoreEntities.DefenseTurnAttempt.RestatedReferenceStep" path="/summary"/>
/// </param>
/// <param name="TakesOver">Whether the reply takes over: the candidate has work, the question keeps none of it, and
/// its answer is a line of the reference. A close, an answer about the statement, exploration help to a blank page
/// and mercy after repeated stalls all come back false.</param>
public record RouteCheckResult(string Work, string Taken, string Restates, bool TakesOver);
