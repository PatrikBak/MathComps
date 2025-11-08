# Load environment variables
. "$PSScriptRoot\Import-Environment.ps1"

# Use environment variables for SSH tunnel
# Creates a local port forward: local port -> remote host:remote port via SSH host
# -i: SSH private key path
# -N: Don't execute remote commands (just forward ports)
# -T: Disable pseudo-terminal allocation
# -L: Local port forwarding (local_port:remote_host:remote_port)
ssh -i "$env:SSH_KEY_PATH" -N -T -L ${env:DB_TUNNEL_PORT}:${env:SSH_REMOTE_HOST}:${env:SSH_REMOTE_PORT} $env:SSH_HOST


