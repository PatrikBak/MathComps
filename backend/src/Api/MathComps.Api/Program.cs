using MathComps.Api.Extensions;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.Json;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using System.Text.Json.Serialization;
using Microsoft.IdentityModel.Tokens;

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
        var authority = builder.Configuration.GetSection("Authentication:Clerk")?["Authority"]
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

// Infrastructure services: options + problem filtering service
builder.Services.AddInfrastructureServices();

// The app configured
var app = builder.Build();

// Configure the HTTP request pipeline
app.ConfigureSecurityPipeline(app.Environment);
app.ConfigureStandardPipeline();

// Actual endpoints mappings happen here
app.MapApiEndpoints();
app.MapWebhookEndpoints();

// Run the API
await app.RunAsync();

// Apparently this shit neeeded
public partial class Program;
