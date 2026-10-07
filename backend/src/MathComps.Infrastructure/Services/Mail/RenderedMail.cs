using MathComps.Domain.EfCoreEntities;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// A mail ready to go, in the recipient's language.
/// </summary>
/// <param name="Subject"><inheritdoc cref="OutgoingMail.Subject" path="/summary"/></param>
/// <param name="Html"><inheritdoc cref="OutgoingMail.Html" path="/summary"/></param>
public sealed record RenderedMail(string Subject, string Html);
