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
            ValidateAudience = false
        };
    });

// Authorization to secure endpoints
builder.Services.AddAuthorization();

// Basic observability
builder.Services.AddLogging();
builder.Services.AddHealthChecks();

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
