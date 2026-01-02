# CLI tool runner with environment support
# Usage: .\Invoke-Tool.ps1 -Env <prod|staging> <command> [args]
# Examples:
#   .\Invoke-Tool.ps1 -Env prod seed
#   .\Invoke-Tool.ps1 -Env staging migrate

param(
    # Environment to use (prod or staging)
    [Parameter()]
    [ValidateSet("prod", "staging")]
    [string]$Env = "prod",    
    
    # Command to run
    [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
    [string[]]$Arguments
)

# Load environment variables with the specified environment
. "$PSScriptRoot\Import-Environment.ps1" -Environment $Env

# Build connection string from environment variables (localhost because we use SSH tunnel)
$env:ConnectionStrings__DefaultConnection = "Host=localhost;Port=$env:DB_TUNNEL_PORT;Database=$env:DB_NAME;Username=$env:DB_USERNAME;Password=$env:DB_PASSWORD"

# The first argument is the command to run
$command = $Arguments[0]

# The remaining arguments are passed to the command
$remainingArgs = if ($Arguments.Length -gt 1) { $Arguments[1..($Arguments.Length - 1)] } else { @() }

# Remember the current location
Push-Location

try {
    # Execute the right command
    switch ($command) {
        "seed" {
            Set-Location ../src/Tools/MathComps.Cli.DatabaseSeeder
            dotnet run -c Release -- @remainingArgs
        }
        "import-tags" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            dotnet run -c Release -- import-tags ../../../../../Scripts/tags.csv
        }
        "tagging" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            dotnet run -c Release -- @remainingArgs
        }
        "update-links" {
            Set-Location ../src/Tools/MathComps.Cli.SkmoScraper
            dotnet run -c Release -- update-solution-links
        }
        "embeddings" {
            Set-Location ../src/Tools/MathComps.Cli.Embeddings
            dotnet run -c Release -- @remainingArgs
        }
        "translations" {
            Set-Location ../src/Tools/MathComps.Cli.Translation
            dotnet run -c Release -- @remainingArgs
        }
        "migrate" {
            Set-Location ../src/Infrastructure/MathComps.Infrastructure
            dotnet ef database update
        }
        
        default {
            Write-Host "Unknown command: $command"
            Write-Host ""
            Write-Host "Usage: .\Invoke-Tool.ps1 -Env <prod|staging> <command> [args]"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  seed           - Seed the database"
            Write-Host "  import-tags    - Import tags from CSV"
            Write-Host "  tagging        - Run tagging assistant"
            Write-Host "  update-links   - Update solution links"
            Write-Host "  embeddings     - Generate embeddings"
            Write-Host "  translations   - Run translation assistant"
            Write-Host "  migrate        - Run database migrations"
        }
    }
}
finally {
    # Regardless of success, ensure we are in the same dir as we started
    Pop-Location
}

