namespace MathComps.Infrastructure.Storage;

/// <summary>
/// Configures where <see cref="TrackedFileUploader"/> keeps its upload ledger. 
/// </summary>
public class UploadLedgerOptions
{
    /// <summary>
    /// The directory of the JSON ledgers, one per remote store, each recording per storage key the hash of the bytes
    /// last pushed under it.
    /// </summary>
    public required string LedgerDirectory { get; init; }
}
