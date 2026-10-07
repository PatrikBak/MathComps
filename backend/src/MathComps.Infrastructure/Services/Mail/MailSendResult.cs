namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// How one attempt to send a mail went.
/// </summary>
public abstract record MailSendResult
{
    /// <summary>
    /// Whether every other mail would be turned away the same way, so none can go until the cause passes.
    /// </summary>
    public abstract bool TurnsAwayEveryMail { get; }
}

/// <summary>
/// The mail went.
/// </summary>
/// <param name="ProviderId">The id the sending provider gave it, or null when no provider gave one.</param>
public sealed record MailSent(string? ProviderId) : MailSendResult
{
    /// <inheritdoc/>
    public override bool TurnsAwayEveryMail => false;
}

/// <summary>
/// A sending quota is spent, so no mail goes before it renews.
/// </summary>
/// <param name="Reason">Which quota the provider named.</param>
public sealed record MailQuotaExhausted(string Reason) : MailSendResult
{
    /// <inheritdoc/>
    public override bool TurnsAwayEveryMail => true;
}

/// <summary>
/// The attempt failed.
/// </summary>
/// <param name="Error">What went wrong, in the words of whatever stopped the attempt.</param>
public sealed record MailFailed(string Error) : MailSendResult
{
    /// <inheritdoc/>
    public override bool TurnsAwayEveryMail => false;
}
