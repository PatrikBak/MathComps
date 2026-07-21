namespace MathComps.Infrastructure.Services.Defense.Dtos;

/// <summary>
/// The generate step's reply: the examiner's next chat message to the candidate, as plain prose. A single-field
/// envelope so the reply rides a schema-constrained structured response — the model fills <see cref="Message"/> and
/// nothing else, which keeps its scaffolding (envelopes, tag wrappers) out of the shipped turn by construction.
/// </summary>
/// <param name="Message">The examiner's next chat message to the candidate.</param>
public record ExaminerReply(string Message);
