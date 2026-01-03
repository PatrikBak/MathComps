# Open SSH tunnel to database
# Usage: .\Open-DbTunnel.ps1 -Env <prod|staging>

param(
    [Parameter()]
    [ValidateSet("prod", "staging")]
    [string]$Env = "prod"
)

# Load environment variables for the specified environment
. "$PSScriptRoot\Import-Environment.ps1" -Environment $Env

# Log port mapping
Write-Host "Opening SSH tunnel to $Env database..."
Write-Host "  Local port: $env:DB_TUNNEL_PORT -> $env:SSH_REMOTE_HOST:$env:SSH_REMOTE_PORT"

# Use environment variables for SSH tunnel
# -i: SSH private key path
# -N: Don't execute remote commands (just forward ports)
# -T: Disable pseudo-terminal allocation
# -L: Local port forwarding (local_port:remote_host:remote_port)
ssh -i "$env:SSH_KEY_PATH" -N -T -L ${env:DB_TUNNEL_PORT}:${env:SSH_REMOTE_HOST}:${env:SSH_REMOTE_PORT} $env:SSH_HOST

