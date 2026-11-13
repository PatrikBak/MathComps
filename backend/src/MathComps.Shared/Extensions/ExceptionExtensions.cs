namespace MathComps.Shared.Extensions;

/// <summary>
/// Extension members for <see cref="Exception"/>, keeping a note for its log line in its <see cref="Exception.Data"/>.
/// </summary>
public static class ExceptionExtensions
{
    /// <summary>
    /// The key an exception's note for its log line is kept under in its data.
    /// </summary>
    private const string LogDetailKey = "MathComps.LogDetail";

    extension(Exception exception)
    {
        /// <summary>
        /// What the exception's log line adds for whoever debugs the failure, such as where it left something to look
        /// at, or null when it adds nothing.
        /// </summary>
        public string? LogDetail
        {
            get => exception.Data[LogDetailKey] as string;
            set => exception.Data[LogDetailKey] = value;
        }
    }
}
