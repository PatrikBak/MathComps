using MathComps.Infrastructure.Services.Mail;

namespace MathComps.Infrastructure.Tests.TestInfrastructure;

/// <summary>
/// A test double for <see cref="IMailSender"/> standing in for the mail provider: it keeps every mail it was handed
/// and answers each with whatever <see cref="Next"/> says.
/// </summary>
public sealed class FakeMailSender : IMailSender
{
    /// <summary>
    /// Every mail handed over, in order.
    /// </summary>
    public List<SentMail> Sent { get; } = [];

    /// <summary>
    /// How the next attempt goes.
    /// </summary>
    public Func<MailSendResult> Next { get; set; } = () => new MailSent("provider-id");

    /// <inheritdoc/>
    public Task<MailSendResult> SendAsync(Guid mailId, string to, RenderedMail mail, CancellationToken cancellationToken)
    {
        // Keep the mail
        Sent.Add(new SentMail(mailId, to, mail));

        // Answer as the test says
        return Task.FromResult(Next());
    }
}

/// <summary>
/// One mail handed to the <see cref="FakeMailSender"/>.
/// </summary>
/// <param name="MailId">The mail's id.</param>
/// <param name="To">The recipient's address.</param>
/// <param name="Mail">The mail.</param>
public sealed record SentMail(Guid MailId, string To, RenderedMail Mail);
