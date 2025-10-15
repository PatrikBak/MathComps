using MathComps.Api.Extensions;
using MathComps.Infrastructure;
using MathComps.Infrastructure.Extensions;
using Microsoft.AspNetCore.Http.Json;
using System.Text.Json.Serialization;

// Standard ASP.NET Core app
var builder = WebApplication.CreateBuilder(args);

// Basic security stuff
builder.Services.AddRateLimiting();
builder.Services.AddCorsConfiguration(builder.Configuration);

// Basic observability
builder.Services.AddLogging();
builder.Services.AddHealthChecks();

// Configure JSON serialization for controllers/minimal APIs
builder.Services.Configure<JsonOptions>(options =>
{
    // Nice enums
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

// Run the API
await app.RunAsync();

// Apparently this shit neeeded
public partial class Program;
