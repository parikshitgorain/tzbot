# Deployment Scripts

This directory contains deployment scripts and configuration for the CI/CD auto-deployment system.

## Structure

- `vps-config.json` - Configuration file for VPS settings (hostname, paths, service name)
- Scripts will be added in subsequent tasks:
  - `deploy.sh` - Main deployment script
  - `rollback.sh` - Rollback to previous version
  - `health-check.sh` - Health check verification
  - `resolve-dns.sh` - Dynamic DNS resolution utility
  - `ssh-connect.sh` - SSH connection utility

## Configuration

Before using the deployment system, update `vps-config.json` with your VPS details:

- `dynamicDnsHostname`: Your Dynamic DNS hostname (e.g., from DuckDNS, No-IP)
- `sshUser`: SSH username for deployment
- `sshPort`: SSH port (default: 22)
- `deploymentPath`: Base path on VPS where the application is deployed
- `serviceName`: PM2 app name or systemd service name
- `healthCheckEndpoint`: Optional HTTP endpoint for health checks

## GitHub Secrets Required

The following secrets must be configured in your GitHub repository:

- `SSH_PRIVATE_KEY`: SSH private key for VPS authentication
- `SSH_USER`: SSH username (can also be set in vps-config.json)
- `DYNAMIC_DNS_HOSTNAME`: Dynamic DNS hostname (can also be set in vps-config.json)
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for deployment notifications

## VPS Setup

See `.github/DEPLOYMENT_GUIDE.md` for detailed VPS setup instructions.
