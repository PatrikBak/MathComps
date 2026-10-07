using System.Text.Encodings.Web;
using System.Text.Unicode;
using MathComps.Infrastructure.Services.Localization;

namespace MathComps.Infrastructure.Services.Mail;

/// <summary>
/// The frame every mail the site sends is written in: the logo heading it, the preview an inbox shows beside the
/// subject, and the footer linking the site's pages under its copyright. Each mail fills it with its own body.
/// </summary>
/// <remarks>
/// It sets no background and no text colour, so every mail app draws it in its own light or dark mode, like a mail
/// from a person. The violet in the wordmark is its only colour. It is written for mail clients: tables, inline
/// styles, and the logo as a PNG the site serves.
/// </remarks>
public static class MailLayout
{
    /// <summary>
    /// The fonts a mail is set in, the site's own first.
    /// </summary>
    private const string FontStack =
        "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

    /// <summary>
    /// How the wordmark beside the logo is set.
    /// </summary>
    private const string WordmarkStyle =
        "display: inline-block; vertical-align: middle; margin-left: 12px; font-size: 24px; font-weight: 700; "
        + "letter-spacing: -0.035em;";

    /// <summary>
    /// How each link in the footer is set.
    /// </summary>
    private const string FooterLinkStyle =
        "display: inline-block; margin-right: 20px; color: inherit; text-decoration: underline;";

    /// <summary>
    /// The encoder every text inserted into a mail goes through, an attribute's value included. It escapes what HTML
    /// gives a meaning to and leaves letters alone, so a diacritic reads as itself in the document.
    /// </summary>
    private static readonly HtmlEncoder _encoder = HtmlEncoder.Create(UnicodeRanges.All);

    /// <summary>
    /// The invisible run after the inbox preview, which a mail app filling the preview past the hidden text shows as
    /// blank rather than as the start of the mail again.
    /// </summary>
    private static readonly string _previewPadding = string.Concat(Enumerable.Repeat("&zwnj;&nbsp;", 100));

    /// <summary>
    /// Writes a text the way a mail's HTML carries it, safe in an element's text and in a quoted attribute's value.
    /// </summary>
    /// <param name="text">The text.</param>
    /// <returns>The text as HTML.</returns>
    public static string Encode(string text) =>
        // Everything HTML gives a meaning to escaped
        _encoder.Encode(text);

    /// <summary>
    /// Writes a whole mail inside the frame.
    /// </summary>
    /// <param name="links">The site's addresses in the recipient's language, which the mail is written in.</param>
    /// <param name="year">The year the mail goes out, which its copyright line carries.</param>
    /// <param name="subject">The subject line.</param>
    /// <param name="preview">The text an inbox shows beside the subject, kept out of the mail itself.</param>
    /// <param name="rows">The body as HTML: rows of the frame's one-column table, each holding one cell.</param>
    /// <returns>The subject and the HTML document.</returns>
    public static RenderedMail Render(SiteLinks links, int year, string subject, string preview, string rows)
    {
        // The frame's own lines in the recipient's language
        var copy = new LocalizedCopy(links.Language, "mail");

        // The preview, then the invisible run after it
        var hiddenPreview = $"{Encode(preview)}{_previewPadding}";

        // The whole document around the body, every inserted text encoded
        var html = $$"""
            <!DOCTYPE html>
            <html lang="{{links.Language.ToString().ToLowerInvariant()}}">
            <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta name="x-apple-disable-message-reformatting">
            <title>{{Encode(subject)}}</title>
            </head>
            <body style="margin: 0; padding: 0;">
            <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">{{hiddenPreview}}</div>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
            <td style="padding: 32px 24px 40px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
            style="max-width: 560px; font-family: {{FontStack}};">
            <tr>
            <td style="padding: 0 0 36px;">
            <a href="{{Encode(links.Home)}}" style="color: inherit; text-decoration: none;"><img
            src="{{Encode(links.Logo)}}" alt="" width="36" height="38"
            style="display: inline-block; vertical-align: middle; border: 0;"><span
            style="{{WordmarkStyle}}">Math<span style="color: #8b5cf6;">Comps</span></span></a>
            </td>
            </tr>
            {{rows}}
            <tr>
            <td style="font-size: 13px; line-height: 1.6;">
            <a href="{{Encode(links.About)}}"
            style="{{FooterLinkStyle}}">{{Encode(copy.Format("about"))}}</a>
            <a href="{{Encode(links.Privacy)}}"
            style="{{FooterLinkStyle}}">{{Encode(copy.Format("privacy"))}}</a>
            <span style="display: inline-block; white-space: nowrap;">© {{year}} MathComps z.s.</span>
            </td>
            </tr>
            </table>
            </td>
            </tr>
            </table>
            </body>
            </html>
            """;

        // The subject with the document
        return new RenderedMail(subject, html);
    }
}
