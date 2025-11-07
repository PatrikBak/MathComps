# Load environment variables from .env.example and .env files
# .env.example is loaded first, then .env (which overrides values from .env.example)

# Helper function to load environment variables from a file
function Load-EnvFile {
    param(
        [string]$FilePath
    )
    
    if (Test-Path $FilePath) {
        # Read the .env file line by line
        Get-Content $FilePath | ForEach-Object {
            # Match lines in format KEY=VALUE (excluding comments starting with #)
            if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)\s*$') {
                # Extract and trim the key and value from the match
                $key = $matches[1].Trim()
                $value = $matches[2].Trim()
                # Set the environment variable
                Set-Item -Path "env:$key" -Value $value
            }
        }
        return $true
    }
    return $false
}

# Construct paths relative to the script directory
$envExampleFile = Join-Path $PSScriptRoot ".env.example"
$envFile = Join-Path $PSScriptRoot ".env"

# Load .env.example first (if it exists)
$exampleLoaded = Load-EnvFile -FilePath $envExampleFile

# Load .env second (overrides values from .env.example)
$envLoaded = Load-EnvFile -FilePath $envFile

# Warn if neither file exists
if (-not $exampleLoaded -and -not $envLoaded) {
    Write-Warning "Neither .env.example nor .env file found in $PSScriptRoot"
}

