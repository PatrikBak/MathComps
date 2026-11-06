namespace MathComps.Infrastructure.Services.Ai;

/// <summary>
/// What one chat call produced, paired with what answered and what the call billed, so a caller can tally cost per
/// unit of work (a turn, a document) rather than only in aggregate.
/// </summary>
/// <typeparam name="TResponse">The shape of what the call produced.</typeparam>
/// <param name="Value">What the call produced from the reply.</param>
/// <param name="ServedModel">The model that answered, which a fallback chain can make a different one from the model
/// asked for.</param>
/// <param name="Usage">What this call billed: its spend and token counts.</param>
public record ChatCallResult<TResponse>(TResponse Value, string ServedModel, ModelUsage Usage);
