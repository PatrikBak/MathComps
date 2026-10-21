using System.Collections.Immutable;
using MathComps.Infrastructure.Storage;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A test double for <see cref="IFileUploader"/> that records uploads instead of hitting remote storage.
/// </summary>
public sealed class RecordingFileUploader : IFileUploader
{
    /// <summary>
    /// Every upload, in call order.
    /// </summary>
    public ImmutableList<(string LocalPath, string Key)> Uploads { get; private set; } = [];

    /// <inheritdoc/>
    public Task UploadAsync(string localFilePath, string key)
    {
        // Record the call.
        Uploads = Uploads.Add((localFilePath, key));

        // Nothing leaves the process.
        return Task.CompletedTask;
    }
}
