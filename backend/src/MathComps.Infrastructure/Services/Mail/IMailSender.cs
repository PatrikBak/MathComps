namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// Sends one mail from the site's own address and says how it went.
/// </summary>
public interface IMailSender
{
    /// <summary>
    /// Sends one mail. Sending the same mail id again within a day sends nothing twice.
    /// </summary>
    /// <param name="mailId">The mail's id, which a repeated attempt shares.</param>
    /// <param name="to">The recipient's address.</param>
    /// <param name="mail">The mail.</param>
    /// <param name="cancellationToken">A token to cancel the work.</param>
    /// <returns>How the attempt went.</returns>
    Task<MailSendResult> SendAsync(Guid mailId, string to, RenderedMail mail, CancellationToken cancellationToken);
}
