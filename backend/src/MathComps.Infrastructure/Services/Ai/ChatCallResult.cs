namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// One structured chat completion's bound reply paired with what the call billed, so a caller can tally cost per
/// unit of work (a turn, a document) rather than only in aggregate.
/// </summary>
/// <typeparam name="TResponse">The structured shape the reply is bound into.</typeparam>
/// <param name="Value">The reply bound to the requested response type.</param>
/// <param name="Usage">What this call billed: its spend and token counts.</param>
public record ChatCallResult<TResponse>(TResponse Value, ModelUsage Usage);
