# Build stage: compile the .NET application
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY Directory.Build.props Directory.Packages.props MathComps.sln ./

# Copy all source files (including .csproj files)
COPY . ./

# Restore the API project
RUN dotnet restore src/Api/MathComps.Api/MathComps.Api.csproj

# Build and publish the API
RUN dotnet publish src/Api/MathComps.Api/MathComps.Api.csproj -c Release -o /app/publish

# Runtime stage: minimal image for running the application
FROM mcr.microsoft.com/dotnet/aspnet:9.0
WORKDIR /app

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy built application from build stage
COPY --from=build /app/publish .

# Expose port 8080 for the API
EXPOSE 8080

# Run the API
ENTRYPOINT ["dotnet", "MathComps.Api.dll"]
