namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Configures where <see cref="TrackedFileUploader"/> keeps its upload ledger. 
/// </summary>
public class UploadLedgerOptions
{
    /// <summary>
    /// Path to the JSON ledger that records, per storage key, the source-file mtime last pushed under it.
    /// </summary>
    public required string LedgerPath { get; init; }
}
