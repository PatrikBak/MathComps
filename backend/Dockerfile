# Build stage: compile the .NET application
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy solution and project files
COPY Directory.Build.props Directory.Packages.props MathComps.sln ./

# Copy all source files (including .csproj files)
COPY . ./

# Restore the API project
RUN dotnet restore src/MathComps.Api/MathComps.Api.csproj

# Build and publish the API
RUN dotnet publish src/MathComps.Api/MathComps.Api.csproj -c Release -o /app/publish

# Restore the pinned EF CLI tool
RUN dotnet tool restore

# Build a migration bundle into the publish folder so it ships alongside the API.
# Infrastructure is both the migrations and startup project (the design-time factory lives there).
# The placeholder connection string only lets the factory build the model — bundling never connects;
# the real one is supplied at runtime via the ConnectionStrings__DefaultConnection env var.
RUN ConnectionStrings__DefaultConnection="Host=build;Database=build;Username=build;Password=build" \
    dotnet ef migrations bundle \
    --project src/MathComps.Infrastructure/MathComps.Infrastructure.csproj \
    --startup-project src/MathComps.Infrastructure/MathComps.Infrastructure.csproj \
    --configuration Release \
    --output /app/publish/efbundle

# Runtime stage: minimal image for running the application
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy built application from build stage
COPY --from=build /app/publish .

# The migration bundle ships beside the API dll; ensure it stays executable.
RUN chmod +x ./efbundle

# Expose port 8080 for the API
EXPOSE 8080

# Run the API
ENTRYPOINT ["dotnet", "MathComps.Api.dll"]
