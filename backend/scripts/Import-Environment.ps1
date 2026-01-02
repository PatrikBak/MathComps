# Load environment variables from .env files
# Usage: . .\Import-Environment.ps1 -Environment <prod|staging>
#
# Loading order:
#   1. .env.example (base defaults)
#   2. .env.{environment}.example (env-specific defaults like ports)
#   3. .env (user secrets)
#   4. .env.{environment} (user env-specific overrides)

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet("prod", "staging")]
    [string]$Environment
)

# Helper function to load environment variables from a file
function Load-EnvFile {
    param(
        # Path to the .env file to load
        [string]$FilePath
    )
    
    # Check if the file exists
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
        # Env loaded successfully
        return $true
    }

    # Env file not found
    return $false
}

# Construct paths relative to the script directory
$envExampleFile = Join-Path $PSScriptRoot ".env.example"
$envEnvExampleFile = Join-Path $PSScriptRoot ".env.$Environment.example"
$envFile = Join-Path $PSScriptRoot ".env"
$envOverrideFile = Join-Path $PSScriptRoot ".env.$Environment"

# 1. Load .env.example (base defaults)
Load-EnvFile -FilePath $envExampleFile | Out-Null

# 2. Load .env.{environment}.example (env-specific defaults)
Load-EnvFile -FilePath $envEnvExampleFile | Out-Null

# 3. Load .env (user secrets)
$envLoaded = Load-EnvFile -FilePath $envFile

# 4. Load .env.{environment} (user env-specific overrides)
Load-EnvFile -FilePath $envOverrideFile | Out-Null

# Warn if .env file doesn't exist (user needs to create this)
if (-not $envLoaded) {
    Write-Warning ".env file not found. Copy .env.example to .env and configure your secrets."
}
