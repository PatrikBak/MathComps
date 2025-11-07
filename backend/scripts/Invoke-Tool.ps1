# Load environment variables
. "$PSScriptRoot\Import-Environment.ps1"

# Build connection string from environment variables
$env:ConnectionStrings__DefaultConnection = "Host=$env:DB_HOST;Port=$env:DB_TUNNEL_PORT;Database=$env:DB_NAME;Username=$env:DB_USERNAME;Password=$env:DB_PASSWORD"

Push-Location
try {
    switch ($args[0]) {
        "seed" {
            Set-Location ../src/Tools/MathComps.Cli.DatabaseSeeder
            dotnet run -c Release -- $args[1..$args.Length]
        }
        "import-tags" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            dotnet run -c Release -- import-tags ../../../../../Scripts/tags.csv
        }
        "tagging" {
            Set-Location ../src/Tools/MathComps.Cli.Tagging
            dotnet run -c Release -- $args[1..$args.Length]
        }
        "update-links" {
            Set-Location ../src/Tools/MathComps.Cli.SkmoScraper
            dotnet run -c Release -- update-solution-links
        }
        "embeddings" {
            Set-Location ../src/Tools/MathComps.Cli.Embeddings
            dotnet run -c Release -- $args[1..$args.Length]
        }
        "translations" {
            Set-Location ../src/Tools/MathComps.Cli.Translation
            dotnet run -c Release -- $args[1..$args.Length]
        }
        "migrate" {
            Set-Location ../src/Infrastructure/MathComps.Infrastructure
            dotnet ef database update
        }
        
        default {
            Write-Host "Unknown command: $($args[0])"
        }
    }
}
finally {
    Pop-Location
}

