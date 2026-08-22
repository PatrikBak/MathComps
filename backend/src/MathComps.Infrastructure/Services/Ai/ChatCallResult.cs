namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// One structured chat completion's bound reply paired with what answered and what the call billed, so a caller can
/// tally cost per unit of work (a turn, a document) rather than only in aggregate.
/// </summary>
/// <typeparam name="TResponse">The structured shape the reply is bound into.</typeparam>
/// <param name="Value">The reply bound to the requested response type.</param>
/// <param name="ServedModel">The model that answered, which a fallback chain can make a different one from the model
/// asked for.</param>
/// <param name="Usage">What this call billed: its spend and token counts.</param>
public record ChatCallResult<TResponse>(TResponse Value, string ServedModel, ModelUsage Usage);
