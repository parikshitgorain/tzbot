# Design Document: CI/CD Auto-Deployment System

## Overview

This design specifies an automated deployment system for a Discord bot application (TypeScript/Node.js) that manages the complete lifecycle from development to production deployment. The system uses GitHub Actions as the CI/CD platform, implements secure SSH-based deployment to a VPS with dynamic IP resolution, and provides automated rollback capabilities.

The architecture follows a pipeline pattern where each stage validates success before proceeding, with automatic rollback on failure. The system integrates with Dynamic DNS services to handle the VPS's changing IP address and uses SSH key authentication for secure deployments.

## Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Developer     │
│  Pushes Code    │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────────────────────────┐
│              GitHub Repository                          │
│  ┌──────────────┐         ┌──────────────┐            │
│  │ Development  │────────>│   Release    │            │
│  │   Branch     │  Merge  │   Branch     │            │
│  └──────┬───────┘         └──────┬───────┘            │
│         │                        │                     │
└─────────┼────────────────────────┼─────────────────────┘
          │                        │
          v                        v
┌─────────────────┐      ┌─────────────────┐
│  GitHub Actions │      │  GitHub Actions │
│   CI Pipeline   │      │   Deployment    │
│  (Run Tests)    │      │    Workflow     │
└─────────┬───────┘      └────────┬────────┘
          │                       │
          │ Tests Pass            │ Trigger Deploy
          v                       v
┌─────────────────┐      ┌─────────────────────────────┐
│ Auto-Merge to   │      │   Deployment Agent          │
│ Release Branch  │      │  - Resolve Dynamic IP       │
└─────────────────┘      │  - SSH Connection           │
                         │  - Transfer & Build Code    │
                         │  - Health Checks            │
                         │  - Rollback on Failure      │
                         └────────┬────────────────────┘
                                  │
                                  v
                         ┌─────────────────┐
                         │   VPS Server    │
                         │  (Dynamic IP)   │
                         │  Discord Bot    │
                         └─────────────────┘
```

### Component Architecture

The system consists of four main components:

1. **CI Pipeline (GitHub Actions)**: Runs tests on development branch
2. **Branch Promoter (GitHub Actions)**: Merges dev to release on test success
3. **Deployment Orchestrator (GitHub Actions)**: Coordinates deployment workflow
4. **Deployment Agent (Shell Scripts + Node.js)**: Executes deployment on VPS

## Components and Interfaces

### 1. CI Pipeline Workflow

**Technology**: GitHub Actions workflow file (`.github/workflows/ci.yml`)

**Responsibilities**:
- Trigger on push to development branch
- Install dependencies and build TypeScript
- Run test suite
- Report test results
- Trigger branch promotion on success

**Interface**:
```yaml
# Inputs: GitHub push event
# Outputs: Test results, build artifacts, promotion trigger
```

**Key Operations**:
- Checkout code
- Setup Node.js environment
- Install dependencies (`npm ci`)
- Build TypeScript (`npm run build`)
- Run tests (`npm test`)
- Conditionally trigger branch promotion workflow

### 2. Branch Promoter Workflow

**Technology**: GitHub Actions workflow file (`.github/workflows/promote.yml`)

**Responsibilities**:
- Merge development branch to release branch
- Handle merge conflicts
- Trigger deployment workflow

**Interface**:
```yaml
# Inputs: CI workflow success event
# Outputs: Updated release branch, deployment trigger
```

**Key Operations**:
- Checkout repository with full history
- Configure git credentials
- Merge development branch to release branch
- Push to release branch
- Handle merge conflicts with notifications

### 3. Deployment Orchestrator Workflow

**Technology**: GitHub Actions workflow file (`.github/workflows/deploy.yml`)

**Responsibilities**:
- Trigger on release branch updates
- Resolve VPS dynamic IP
- Execute deployment via SSH
- Run health checks
- Trigger rollback on failure
- Send notifications

**Interface**:
```yaml
# Inputs: Release branch push event
# Outputs: Deployment status, notifications
# Secrets: SSH_PRIVATE_KEY, DYNAMIC_DNS_HOSTNAME, DISCORD_WEBHOOK_URL
```

**Key Operations**:
- Resolve VPS IP from Dynamic DNS
- Establish SSH connection
- Execute remote deployment script
- Monitor deployment progress
- Verify health checks
- Execute rollback if needed

### 4. Deployment Agent Scripts

**Technology**: Shell scripts + Node.js scripts on VPS

**Responsibilities**:
- Receive deployment commands via SSH
- Pull latest code from release branch
- Install dependencies and build
- Manage application service (stop/start/restart)
- Maintain deployment history
- Execute rollback operations

**Interface**:
```bash
# deploy.sh - Main deployment script
# rollback.sh - Rollback to previous version
# health-check.sh - Verify application health
```

**Key Operations**:
- Create timestamped backup of current version
- Pull latest code from git
- Install dependencies
- Build TypeScript
- Restart application service (PM2/systemd)
- Verify service health
- Restore backup on failure

## Data Models

### Deployment Record

```typescript
interface DeploymentRecord {
  id: string;                    // Unique deployment ID
  commitHash: string;            // Git commit SHA
  branch: string;                // Source branch (should be 'release')
  timestamp: Date;               // Deployment start time
  initiatedBy: string;           // GitHub username
  status: 'in_progress' | 'success' | 'failed' | 'rolled_back';
  duration: number;              // Deployment duration in seconds
  healthCheckResults: HealthCheckResult[];
  errorMessage?: string;         // Error details if failed
  rolledBackTo?: string;         // Previous commit hash if rolled back
}
```

### Health Check Result

```typescript
interface HealthCheckResult {
  checkName: string;             // Name of the health check
  passed: boolean;               // Check result
  timestamp: Date;               // When check was performed
  details: string;               // Additional information
}
```

### VPS Configuration

```typescript
interface VPSConfig {
  dynamicDnsHostname: string;    // e.g., "mybot.ddns.net"
  sshUser: string;               // SSH username
  sshPort: number;               // SSH port (default 22)
  deploymentPath: string;        // Path on VPS where app is deployed
  serviceName: string;           // Service name (PM2 app name or systemd service)
  healthCheckEndpoint?: string;  // Optional HTTP endpoint for health check
}
```

### Notification Message

```typescript
interface NotificationMessage {
  type: 'deployment_started' | 'deployment_success' | 'deployment_failed' | 'rollback_executed';
  deploymentId: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  details: string;
  errorMessage?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: CI Pipeline Execution on Push

*For any* commit pushed to the Development_Branch, the CI_Pipeline should execute all automated tests and report results with pass/fail status.

**Validates: Requirements 1.1, 1.2**

### Property 2: Promotion Prevention on Test Failure

*For any* test run that fails on the Development_Branch, the system should prevent promotion to the Release_Branch.

**Validates: Requirements 1.3**

### Property 3: Automatic Branch Promotion on Success

*For any* test run that passes on the Development_Branch, the Branch_Promoter should merge the changes to the Release_Branch and preserve commit history and authorship.

**Validates: Requirements 1.4, 2.1, 2.2**

### Property 4: Deployment Trigger on Release Update

*For any* update to the Release_Branch, the system should trigger the deployment workflow.

**Validates: Requirements 2.4**

### Property 5: Dynamic DNS Resolution

*For any* deployment initiation, the Deployment_Agent should query the Dynamic_DNS_Service to resolve the current VPS IP address.

**Validates: Requirements 3.1, 3.2**

### Property 6: DNS Retry with Exponential Backoff

*For any* Dynamic_DNS_Service failure, the system should retry with exponential backoff up to 5 attempts before aborting.

**Validates: Requirements 3.3**

### Property 7: SSH Key Authentication

*For any* VPS connection attempt, the Deployment_Agent should authenticate using SSH key-based authentication.

**Validates: Requirements 4.1**

### Property 8: Encrypted File Transfer

*For any* file transfer to the VPS, the Deployment_Agent should use encrypted protocols (SSH/SCP/RSYNC over SSH).

**Validates: Requirements 4.3**

### Property 9: No Plaintext Credentials

*For any* deployment operation, the system should not store or log plaintext credentials in any logs or storage.

**Validates: Requirements 4.4**

### Property 10: Deployment Pipeline Ordering

*For any* Release_Branch update, the deployment should follow the correct sequence: transfer code, install dependencies, build application, restart service, and wait for initialization.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

### Property 11: Health Check Execution

*For any* application service start, the Health_Check should verify both that the process is running and that the Discord bot connects to the Discord API.

**Validates: Requirements 6.1, 6.2**

### Property 12: Deployment Status Based on Health Checks

*For any* deployment, if health checks pass the deployment should be marked successful, and if any health check fails within 60 seconds the deployment should be marked failed.

**Validates: Requirements 6.3, 6.4**

### Property 13: Deployment Notifications

*For any* deployment event (start, success, failure, or rollback), the system should send a notification to relevant stakeholders with appropriate details.

**Validates: Requirements 6.5, 9.1, 9.2, 9.3, 9.4**

### Property 14: Automatic Rollback on Health Check Failure

*For any* deployment that fails health checks, the Rollback_Manager should restore the previous working version.

**Validates: Requirements 7.1**

### Property 15: Rollback Pipeline Ordering

*For any* rollback operation, the system should follow the correct sequence: stop current version, restore previous code, restart service, and verify health checks.

**Validates: Requirements 7.2, 7.3, 7.4, 7.5**

### Property 16: Complete Deployment Records

*For any* deployment, the system should record the commit hash, timestamp, initiating user at start, and final status at completion.

**Validates: Requirements 8.1, 8.2**

### Property 17: Deployment History Retention

*For any* sequence of deployments, the system should maintain a history of at least the last 10 deployments.

**Validates: Requirements 8.3**

### Property 18: Current Deployment Query

*For any* query to the system, it should report the currently deployed commit hash and deployment timestamp.

**Validates: Requirements 8.4**

### Property 19: Deployment Log Persistence

*For any* deployment, the system should store deployment logs for troubleshooting and audit purposes.

**Validates: Requirements 8.5**

### Property 20: Notification Failure Graceful Degradation

*For any* notification delivery failure, the system should log the failure but continue operation without blocking deployment.

**Validates: Requirements 9.5**

### Property 21: Webhook Authentication

*For any* webhook request from GitHub Actions, the system should authenticate using shared secrets and validate the source branch matches Release_Branch.

**Validates: Requirements 10.2, 10.3, 10.4**

## Error Handling

### DNS Resolution Failures

**Scenario**: Dynamic DNS service is unavailable or returns invalid responses

**Handling**:
- Implement exponential backoff retry (5 attempts: 1s, 2s, 4s, 8s, 16s)
- Log each retry attempt with timestamp
- After exhausting retries, abort deployment
- Send critical alert to administrators
- Do not proceed with deployment using cached/stale IP addresses

### SSH Connection Failures

**Scenario**: Cannot establish SSH connection to VPS

**Handling**:
- Verify DNS resolution succeeded
- Attempt SSH connection with timeout (30 seconds)
- Retry SSH connection up to 3 times
- Check SSH key permissions and validity
- Log detailed connection error messages
- Abort deployment and alert administrators
- Do not attempt deployment without verified connection

### Build Failures

**Scenario**: TypeScript build fails during deployment

**Handling**:
- Capture full build output and error messages
- Stop deployment immediately
- Do not restart application service
- Preserve current running version
- Log build errors with context
- Send failure notification with build logs
- Mark deployment as failed

### Health Check Failures

**Scenario**: Application fails health checks after deployment

**Handling**:
- Wait up to 60 seconds for health checks to pass
- Log each health check attempt and result
- If any check fails, trigger automatic rollback
- Stop the newly deployed version
- Restore previous working version
- Restart service with previous version
- Verify previous version passes health checks
- Send rollback notification with failure details

### Rollback Failures

**Scenario**: Rollback operation fails to restore previous version

**Handling**:
- This is a critical failure requiring immediate attention
- Log all rollback steps and failure point
- Send critical priority alert to administrators
- Do not attempt further automatic recovery
- Preserve all logs and state for debugging
- Require manual intervention to restore service

### Merge Conflicts

**Scenario**: Cannot automatically merge development to release branch

**Handling**:
- Halt automatic promotion
- Log conflict details and affected files
- Send notification to developer with conflict information
- Require manual conflict resolution
- Do not force-push or auto-resolve conflicts
- Wait for developer to resolve and re-trigger

### Notification Delivery Failures

**Scenario**: Cannot send notifications (Discord webhook down, network issues)

**Handling**:
- Log notification failure with timestamp
- Continue deployment operation (non-blocking)
- Store failed notification for retry
- Attempt retry after 5 minutes
- Do not block deployment on notification failures
- Ensure deployment logs capture all events

## Testing Strategy

### Dual Testing Approach

This system requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Test specific deployment scenarios with known inputs
- Test error handling for specific failure modes (DNS timeout, SSH failure, etc.)
- Test notification formatting and delivery
- Test deployment record serialization/deserialization
- Test health check implementations

**Property-Based Tests**: Verify universal properties across all inputs
- Test deployment pipeline ordering with random commit data
- Test retry logic with various failure patterns
- Test rollback behavior with random deployment states
- Test notification triggering for all event types
- Test deployment history retention across many deployments

### Property-Based Testing Configuration

**Testing Library**: Use `fast-check` for TypeScript/Node.js property-based testing

**Configuration**:
- Minimum 100 iterations per property test
- Each test must reference its design document property
- Tag format: `Feature: cicd-automation, Property {number}: {property_text}`

**Example Property Test Structure**:
```typescript
import fc from 'fast-check';

// Feature: cicd-automation, Property 10: Deployment Pipeline Ordering
test('deployment follows correct sequence', () => {
  fc.assert(
    fc.property(
      fc.record({
        commitHash: fc.hexaString({ minLength: 40, maxLength: 40 }),
        branch: fc.constant('release'),
        timestamp: fc.date()
      }),
      async (deploymentData) => {
        const steps = await executeDeployment(deploymentData);
        
        // Verify ordering: transfer -> install -> build -> restart -> wait
        expect(steps[0].name).toBe('transfer_code');
        expect(steps[1].name).toBe('install_dependencies');
        expect(steps[2].name).toBe('build_application');
        expect(steps[3].name).toBe('restart_service');
        expect(steps[4].name).toBe('wait_for_initialization');
        
        // Verify each step completed before next started
        for (let i = 0; i < steps.length - 1; i++) {
          expect(steps[i].endTime).toBeLessThanOrEqual(steps[i + 1].startTime);
        }
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

**GitHub Actions Workflow Testing**:
- Use `act` tool to test workflows locally
- Test workflow triggers and conditions
- Test secret handling and environment variables
- Test workflow job dependencies

**SSH Deployment Testing**:
- Use Docker containers to simulate VPS environment
- Test SSH key authentication
- Test file transfer and permissions
- Test service management commands

**End-to-End Testing**:
- Set up test repository with dev and release branches
- Trigger full deployment pipeline
- Verify all stages execute correctly
- Test rollback scenarios
- Verify notifications are sent

### Test Environment Setup

**Requirements**:
- Test GitHub repository with Actions enabled
- Test VPS or Docker container simulating VPS
- Test Dynamic DNS hostname (or mock DNS service)
- Test Discord webhook for notifications
- SSH key pair for testing

**Mock Services**:
- Mock Dynamic DNS service for testing IP resolution
- Mock Discord API for health check testing
- Mock notification service for testing alerts

## Implementation Notes

### Dynamic DNS Setup

The VPS must be configured with a Dynamic DNS client that updates the DNS record when the IP changes. Recommended services:
- DuckDNS (free, simple)
- No-IP (free tier available)
- Dynu (free tier available)

The deployment system will use the stable hostname (e.g., `mybot.duckdns.org`) instead of the IP address.

### SSH Key Management

**GitHub Secrets**:
- Store SSH private key in GitHub repository secret: `SSH_PRIVATE_KEY`
- Store VPS username in secret: `SSH_USER`
- Store Dynamic DNS hostname in secret: `DYNAMIC_DNS_HOSTNAME`

**VPS Setup**:
- Add corresponding public key to `~/.ssh/authorized_keys`
- Ensure SSH service is running and accessible
- Configure firewall to allow SSH connections

### Application Service Management

**Recommended**: Use PM2 for Node.js process management on VPS

**PM2 Setup**:
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start dist/index.js --name discord-bot

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

**Alternative**: Use systemd service for more control

### Deployment Directory Structure

```
/opt/discord-bot/
├── current/              # Current running version (symlink)
├── releases/
│   ├── 2024-01-15-abc123/  # Timestamped releases
│   ├── 2024-01-16-def456/
│   └── 2024-01-17-ghi789/
├── shared/
│   ├── node_modules/     # Shared dependencies (optional)
│   └── .env              # Environment variables
└── deployment-history.json
```

This structure allows quick rollbacks by changing the `current` symlink.

### Health Check Implementation

**Process Check**:
```bash
# Check if PM2 process is running
pm2 list | grep discord-bot | grep online
```

**Discord Connection Check**:
```typescript
// In application code, expose health endpoint or status file
async function checkDiscordConnection(): Promise<boolean> {
  return client.ws.status === 0; // 0 = READY
}
```

### Notification Setup

**Discord Webhook**:
- Create webhook in Discord server settings
- Store webhook URL in GitHub secret: `DISCORD_WEBHOOK_URL`
- Use webhook to send deployment notifications

**Notification Format**:
```json
{
  "embeds": [{
    "title": "🚀 Deployment Started",
    "description": "Deploying commit abc123 to production",
    "color": 3447003,
    "fields": [
      { "name": "Commit", "value": "abc123", "inline": true },
      { "name": "Author", "value": "username", "inline": true },
      { "name": "Branch", "value": "release", "inline": true }
    ],
    "timestamp": "2024-01-17T10:30:00Z"
  }]
}
```

### Deployment Logging

**Log Locations**:
- GitHub Actions logs: Automatically captured by GitHub
- VPS deployment logs: `/var/log/discord-bot-deployment.log`
- Application logs: Managed by PM2 (`~/.pm2/logs/`)

**Log Rotation**:
- Configure logrotate for deployment logs
- PM2 handles application log rotation automatically

### Security Considerations

**SSH Hardening**:
- Use SSH keys only (disable password authentication)
- Use non-standard SSH port if possible
- Configure fail2ban to prevent brute force attacks
- Limit SSH access to specific IP ranges if possible

**Secret Management**:
- Never commit secrets to repository
- Use GitHub encrypted secrets for all sensitive data
- Rotate SSH keys periodically
- Use separate SSH keys for CI/CD (not personal keys)

**VPS Security**:
- Keep system packages updated
- Configure firewall (ufw/iptables)
- Only expose necessary ports (SSH, application ports)
- Regular security audits and updates
