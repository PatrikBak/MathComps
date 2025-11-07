# Load environment variables
. "$PSScriptRoot\Import-Environment.ps1"

# Use environment variables for SSH tunnel
ssh -i "$env:SSH_KEY_PATH" -N -T -L ${env:SSH_LOCAL_PORT}:${env:SSH_REMOTE_HOST}:${env:SSH_REMOTE_PORT} $env:SSH_HOST


