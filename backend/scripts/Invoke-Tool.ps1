# CLI tool runner with environment support
# Usage: .\Invoke-Tool.ps1 -Env <prod|staging> <command> [args]
#        .\Invoke-Tool.ps1 <command> -Profile <ProfileName>
# Examples:
#   .\Invoke-Tool.ps1 seed
#   .\Invoke-Tool.ps1 tagging -Profile "Veto Tags"
#   .\Invoke-Tool.ps1 -Env staging migrate

param(
    # Environment to use (prod or staging)
    [Parameter()]
    [ValidateSet("prod", "staging")]
    [string]$Env = "prod",

    # Launch profile to use (from launchSettings.json)
    [Parameter()]
    [string]$Profile,
    
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

# Helper function to run dotnet with profile or args
function Invoke-Dotnet {
    # Use the specified launch profile
    if ($Profile) {
        dotnet run -c Release --launch-profile $Profile
    }     
    # No args: use default profile from launchSettings.json
    elseif ($remainingArgs.Count -eq 0) {
        dotnet run -c Release
    } 
    # Pass args to the application
    else {
        dotnet run -c Release -- $remainingArgs
    }
}

try {
    # Execute the right command
    switch ($command) {
        "seed" {
            Set-Location ../src/Tools/MathComps.Cli.DatabaseSeeder
            Invoke-Dotnet
        }
        "import-tags" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            Invoke-Dotnet -- import-tags ../../../../../Scripts/tags.csv
        }
        "tagging" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            Invoke-Dotnet
        }
        "update-links" {
            Set-Location ../src/Tools/MathComps.Cli.SkmoScraper
            dotnet run -c Release -- update-solution-links
        }
        "embeddings" {
            Set-Location ../src/Tools/MathComps.Cli.Embeddings
            Invoke-Dotnet
        }
        "translations" {
            Set-Location ../src/Tools/MathComps.Cli.Translation
            Invoke-Dotnet
        }
        "migrate" {
            Set-Location ../src/Infrastructure/MathComps.Infrastructure
            dotnet ef database update
        }
        "sync-users" {
            Set-Location ../src/Tools/MathComps.Cli.UserSync
            Invoke-Dotnet
        }
        
        default {
            Write-Host "Unknown command: $command"
            Write-Host ""
            Write-Host "Usage: .\Invoke-Tool.ps1 [-Env <prod|staging>] <command> [-Profile <ProfileName>] [args]"
            Write-Host ""
            Write-Host "Options:"
            Write-Host "  -Env        Environment (prod or staging, default: prod)"
            Write-Host "  -Profile    Launch profile from launchSettings.json"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  seed           - Seed the database"
            Write-Host "  import-tags    - Import tags from CSV"
            Write-Host "  tagging        - Run tagging assistant"
            Write-Host "  update-links   - Update solution links"
            Write-Host "  embeddings     - Generate embeddings"
            Write-Host "  translations   - Run translation assistant"
            Write-Host "  migrate        - Run database migrations"
            Write-Host "  sync-users     - Sync all users from Clerk"
        }
    }
}
finally {
    # Regardless of success, ensure we are in the same dir as we started
    Pop-Location
}
