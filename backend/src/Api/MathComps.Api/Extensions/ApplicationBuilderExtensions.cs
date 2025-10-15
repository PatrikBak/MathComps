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
        app.UseForwardedHeaders(new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
        });

        // Enforce HSTS for production
        if (environment.IsProduction())
            app.UseHsts();

        // Add security headers to protect against common attacks
        app.Use(async (context, next) =>
        {
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

        // We can serve wwwroot content
        app.UseStaticFiles();

        // We can take requests from the website
        app.UseCors("default");

        // Enable rate limiting middleware
        app.UseRateLimiter();

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
