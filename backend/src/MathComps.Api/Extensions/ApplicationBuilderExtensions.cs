using Microsoft.AspNetCore.HttpOverrides;

namespace MathComps.Api.Extensions;

/// <summary>
/// Extension methods for configuring the application pipeline.
/// </summary>
public static class ApplicationBuilderExtensions
{
    /// <summary>
    /// Configures the security pipeline with headers and middleware.
    /// </summary>
    /// <param name="app">The application builder to configure.</param>
    /// <param name="environment">The hosting environment.</param>
    /// <returns>The configured application builder for chaining.</returns>
    public static IApplicationBuilder ConfigureSecurityPipeline(this IApplicationBuilder app, IWebHostEnvironment environment)
    {
        // Respect reverse proxy headers when hosted behind a proxy
        var forwardedHeadersOptions = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        };

        // Default trust is loopback only; the proxy reaches us from the Docker bridge, so lift the
        // allowlist. Safe because the API port is closed to the host, so the proxy is the only ingress,
        // and the default ForwardLimit of 1 reads the rightmost (proxy-appended) entry — unspoofable.
        forwardedHeadersOptions.KnownIPNetworks.Clear();
        forwardedHeadersOptions.KnownProxies.Clear();

        // Apply the forwarded headers so RemoteIpAddress is the real client
        app.UseForwardedHeaders(forwardedHeadersOptions);

        // Enforce HSTS for production
        if (environment.IsProduction())
            app.UseHsts();

        // Add security headers to protect against common attacks
        app.Use(async (context, next) =>
        {
            // No need to index API
            context.Response.Headers.Append("X-Robots-Tag", "noindex, nofollow");

            // Friendly invite for anyone scripting against the API
            context.Response.Headers.Append("X-Api-Contact",
                "If you'd like to use our API, it would be very kind if you dropped us an email at contact@mathcomps.fun");

            // Prevent clickjacking attacks
            context.Response.Headers.Append("X-Frame-Options", "DENY");

            // Prevent MIME type sniffing attacks
            context.Response.Headers.Append("X-Content-Type-Options", "nosniff");

            // Enable XSS protection (legacy but still useful)
            context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");

            // Restrict referrer information for privacy
            context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");

            // Content Security Policy - restrict resource loading
            // Allow inline scripts for KaTeX math rendering
            // Allow inline styles for math rendering
            // Allow data URLs for SVG images
            context.Response.Headers.Append("Content-Security-Policy",
                "default-src 'self'; " +
                "script-src 'self' 'unsafe-inline'; " +
                "style-src 'self' 'unsafe-inline'; " +
                "img-src 'self' data:; " +
                "font-src 'self'; " +
                "connect-src 'self'");

            // Next task
            await next();
        });

        // Return the app for chaining
        return app;
    }

    /// <summary>
    /// Configures the standard ASP.NET Core middleware pipeline.
    /// </summary>
    /// <param name="app">The application builder to configure.</param>
    /// <returns>The configured application builder for chaining.</returns>
    public static IApplicationBuilder ConfigureStandardPipeline(this IApplicationBuilder app)
    {
        // Traefik handles HTTPS redirection; no need to do it in the app

        // We can take requests from the website
        app.UseCors("default");

        // Enable rate limiting middleware
        app.UseRateLimiter();

        // Enable authentication and authorization
        app.UseAuthentication();
        app.UseAuthorization();

        // Add request logging middleware for security monitoring
        app.Use(async (context, next) =>
        {
            // Get the logger
            var logger = context.RequestServices.GetRequiredService<ILogger<Program>>();

            // Log incoming requests
            logger.LogInformation("Request: {Method} {Path} from {RemoteIp}",
                context.Request.Method,
                context.Request.Path,
                context.Connection.RemoteIpAddress);

            // Next task
            await next();

            // Log response status
            logger.LogInformation("Response: {StatusCode} for {Method} {Path}",
                context.Response.StatusCode,
                context.Request.Method,
                context.Request.Path);
        });

        // Return the app for chaining
        return app;
    }
}
