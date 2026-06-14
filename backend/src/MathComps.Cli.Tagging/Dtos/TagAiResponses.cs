namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// One entry of the generate pass's response: how well a tag fits and why.
/// </summary>
/// <param name="GoodnessOfFit">The fitness score, 0–1.</param>
/// <param name="Justification">Why the model gave that score.</param>
public record TagFitness(float GoodnessOfFit, string Justification);

/// <summary>
/// One entry of the veto pass's response: whether a proposed tag holds up.
/// </summary>
/// <param name="Approved">Whether the tag is kept.</param>
/// <param name="Reason">Why it was rejected (the model gives a reason only on rejection).</param>
public record TagApprovalDecision(bool Approved, string Reason);
