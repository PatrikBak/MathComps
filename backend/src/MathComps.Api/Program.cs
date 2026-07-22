using MathComps.Api.Constants;
using MathComps.Api.Errors;
using MathComps.Api.Extensions;
using MathComps.Infrastructure.Extensions;
using MathComps.Infrastructure.Options;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Localization;
using System.Globalization;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.Tokens;
using MathComps.Domain.Localization;

// Standard ASP.NET Core app
var builder = WebApplication.CreateBuilder(args);

// Cross-service config shared with the examiner CLI, copied to output from Infrastructure: the OpenRouter
// endpoint and the examiner engine's per-step models. Kept here so the API and CLI don't repeat them.
// These files ship only in the build output (transitively from Infrastructure), not the project dir, so
// resolve them from the output directory rather than the content root — otherwise `dotnet run`, whose
// content root is the project dir, can't find them. Each file takes an optional per-environment overlay,
// and env vars are re-asserted last so they, and the overlays, can override these sections (which would
// otherwise sit on top of the whole default chain).
builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFileWithEnvironmentOverlay("appsettings.openrouter.json", builder.Environment)
    .AddJsonFileWithEnvironmentOverlay("appsettings.examiner.json", builder.Environment)
    .AddEnvironmentVariables();

// Basic security stuff
builder.Services.AddRateLimiting();
builder.Services.AddCorsConfiguration(builder.Configuration);

// JWT authentication for Clerk
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Parse the Clerk configuration
        var authority = builder.Configuration.GetSection("Authentication:Clerk")["Authority"]
            ?? throw new InvalidOperationException("Clerk authority not found");

        // Tell the middleware where to find the keys (OIDC Discovery)
        options.Authority = authority;

        // Prevent mapping of standard claims (like 'sub') to .NET specific types
        options.MapInboundClaims = false;

        // Setup the validation rules
        options.TokenValidationParameters = new TokenValidationParameters
        {
            // Make sure the token is from Clerk
            ValidateIssuer = true,
            ValidIssuer = authority,

            // Don't allow expired tokens
            ValidateLifetime = true,

            // Clerk tokens don't have an audience by default
            ValidateAudience = false,

            // The flat Role claim Clerk shapes from public_metadata drives RequireRole
            RoleClaimType = ClerkClaims.RoleClaimType
        };

        // Give the middleware's own rejections the same coded problem body an endpoint failure carries
        options.Events = new JwtBearerEvents
        {
            // A missing, malformed, or expired token challenges before any endpoint runs
            OnChallenge = async challengeContext =>
            {
                // Take over the response so the default bare 401 doesn't get written
                challengeContext.HandleResponse();

                // Resolve the problem writer for this request
                var problemDetailsService = challengeContext.HttpContext.RequestServices
                    .GetRequiredService<IProblemDetailsService>();

                // Write our coded 401
                await ProblemResponseWriter.WriteAsync(
                    problemDetailsService,
                    challengeContext.HttpContext,
                    StatusCodes.Status401Unauthorized,
                    ApiErrorCode.Unauthenticated,
                    "Authentication is required for this endpoint.");
            },

            // An authenticated caller who fails the role/policy check is forbidden
            OnForbidden = async forbiddenContext =>
            {
                // Resolve the problem writer for this request
                var problemDetailsService = forbiddenContext.HttpContext.RequestServices
                    .GetRequiredService<IProblemDetailsService>();

                // Write our coded 403
                await ProblemResponseWriter.WriteAsync(
                    problemDetailsService,
                    forbiddenContext.HttpContext,
                    StatusCodes.Status403Forbidden,
                    ApiErrorCode.Forbidden,
                    "You do not have permission to perform this action.");
            }
        };
    });

// Authorization to secure endpoints, with an admin-only policy
builder.Services.AddAuthorizationBuilder()
    .AddPolicy(AuthorizationPolicies.Admin, policy => policy.RequireRole(ClerkClaims.AdminRole));

// Basic observability
builder.Services.AddLogging();
builder.Services.AddHealthChecks();

// RFC 9457 problem responses plus the last-resort handler for exceptions that escape the endpoints
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// Configure JSON serialization for controllers/minimal APIs
builder.Services.Configure<JsonOptions>(options =>
{
    // Nice enums, the frontend likes them
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

// Make sure we have DB
builder.Services.AddMathCompsDbContext(builder.Configuration);

// Problem browsing and filtering
builder.Services.AddProblemServices();

// User accounts and comments
builder.Services.AddUserServices();

// The OpenRouter chat stack and the AI-examiner defense feature
builder.Services.AddOpenRouterChat(builder.Configuration);
builder.Services.AddDefenseServices(builder.Configuration);

// The Clerk webhook handler
builder.Services.AddClerkWebhook();

// Request localization for Accept-Language header support
// Auto-detect supported cultures from the Language enum
var supportedCultures = Enum.GetValues<Language>()
    .Select(lang => new CultureInfo(lang.ToString().ToLowerInvariant()))
    .ToArray();

// Get default locale from configuration
var defaultLocale = builder.Configuration
    .GetSection(LocalizationOptions.ConfigurationSectionName)
    .Get<LocalizationOptions>()
    ?.DefaultLocale
    ?? throw new InvalidOperationException("Localization options not configured.");

// Configure request localization
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    // Set default locale based on the configuration
    options.DefaultRequestCulture = new RequestCulture(defaultLocale.ToString().ToLowerInvariant());

    // Set supported cultures
    options.SupportedCultures = supportedCultures;
    options.SupportedUICultures = supportedCultures;

    // Use Accept-Language header as the primary source
    options.RequestCultureProviders = [new AcceptLanguageHeaderRequestCultureProvider()];
});

// The app configured
var app = builder.Build();

// Catch anything that escapes the endpoints and render it as a clean problem response (outermost)
app.UseExceptionHandler();

// Enable request localization (must be early in the pipeline)
app.UseRequestLocalization();

// Configure the HTTP request pipeline
app.ConfigureSecurityPipeline(app.Environment);
app.ConfigureStandardPipeline();

// Actual endpoints mappings happen here
app.MapApiEndpoints();
app.MapWebhookEndpoints();

// Run the API
await app.RunAsync();
