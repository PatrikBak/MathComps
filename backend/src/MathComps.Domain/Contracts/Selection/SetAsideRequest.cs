namespace MathComps.Domain.Contracts.Selection;

/// <summary>
/// A request to set a proposal aside, or bring it back.
/// </summary>
/// <param name="IsSetAside">Whether the proposal should be set aside, null when the request sent null.</param>
public record SetAsideRequest(bool? IsSetAside);
