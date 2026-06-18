using System.Collections.Immutable;

namespace MathComps.Cli.Tagging.Dtos;

/// <summary>
/// One entry of the generate pass's response: a tag, how well it fits, and why.
/// </summary>
/// <param name="Name">The tag name, exactly as it was offered in the candidate list.</param>
/// <param name="GoodnessOfFit">The fitness score, 0–1.</param>
/// <param name="Justification">Why the model gave that score.</param>
public record TagFitnessEntry(string Name, float GoodnessOfFit, string Justification);

/// <summary>
/// The generate pass's response: one scored entry per candidate tag.
/// </summary>
/// <param name="Tags">The scored entries.</param>
public record GeneratePassResponse(ImmutableArray<TagFitnessEntry> Tags);

/// <summary>
/// One entry of the veto pass's response: a tag and whether it holds up.
/// </summary>
/// <param name="Name">The tag name, exactly as it was offered in the candidate list.</param>
/// <param name="Approved">Whether the tag is kept.</param>
/// <param name="Justification">Why it was rejected (the model gives a reason only on rejection).</param>
public record TagApprovalEntry(string Name, bool Approved, string Justification);

/// <summary>
/// The veto pass's response: one approve/reject decision per candidate tag.
/// </summary>
/// <param name="Tags">The decisions.</param>
public record VetoPassResponse(ImmutableArray<TagApprovalEntry> Tags);

/// <summary>
/// A tag's fitness keyed by slug inside the tagging core: how well it fits and why.
/// </summary>
/// <param name="GoodnessOfFit">The fitness score, 0–1.</param>
/// <param name="Justification">Why the model gave that score.</param>
public record TagFitness(float GoodnessOfFit, string Justification);
