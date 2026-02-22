/**
 * CI/CD Deployment System Types
 *
 * Type definitions for the automated deployment system that manages
 * deployment records, configurations, and health checks.
 */

/**
 * Deployment status enumeration
 */
export type DeploymentStatus = 'in_progress' | 'success' | 'failed' | 'rolled_back';

/**
 * Deployment record tracking a single deployment operation
 *
 * @property id - Unique deployment identifier
 * @property commitHash - Git commit SHA being deployed
 * @property branch - Source branch (should be 'release')
 * @property timestamp - Deployment start time
 * @property initiatedBy - GitHub username who triggered deployment
 * @property status - Current deployment status
 * @property duration - Deployment duration in seconds
 * @property healthCheckResults - Results from health check execution
 * @property errorMessage - Error details if deployment failed
 * @property rolledBackTo - Previous commit hash if rolled back
 */
export interface DeploymentRecord {
  id: string;
  commitHash: string;
  branch: string;
  timestamp: Date;
  initiatedBy: string;
  status: DeploymentStatus;
  duration: number;
  healthCheckResults: HealthCheckResult[];
  errorMessage?: string;
  rolledBackTo?: string;
}

/**
 * Health check result for a single verification
 *
 * @property checkName - Name of the health check
 * @property passed - Whether the check passed
 * @property timestamp - When the check was performed
 * @property details - Additional information about the check
 */
export interface HealthCheckResult {
  checkName: string;
  passed: boolean;
  timestamp: Date;
  details: string;
}

/**
 * VPS configuration for deployment operations
 *
 * @property dynamicDnsHostname - Dynamic DNS hostname (e.g., "mybot.ddns.net")
 * @property sshUser - SSH username for authentication
 * @property sshPort - SSH port (default 22)
 * @property deploymentPath - Base path on VPS where app is deployed
 * @property serviceName - Service name (PM2 app name or systemd service)
 * @property healthCheckEndpoint - Optional HTTP endpoint for health checks
 * @property releasesPath - Path where timestamped releases are stored
 * @property currentSymlink - Path to symlink pointing to current release
 * @property sharedPath - Path for shared resources (node_modules, .env)
 * @property deploymentHistoryFile - Path to deployment history JSON file
 * @property maxDeploymentHistory - Maximum number of deployments to retain
 * @property healthCheckTimeout - Timeout in seconds for health checks
 * @property sshConnectionTimeout - Timeout in seconds for SSH connections
 * @property sshRetryAttempts - Number of SSH connection retry attempts
 * @property dnsRetryAttempts - Number of DNS resolution retry attempts
 * @property dnsRetryDelays - Delay in seconds for each DNS retry attempt
 */
export interface VPSConfig {
  dynamicDnsHostname: string;
  sshUser: string;
  sshPort: number;
  deploymentPath: string;
  serviceName: string;
  healthCheckEndpoint?: string;
  releasesPath: string;
  currentSymlink: string;
  sharedPath: string;
  deploymentHistoryFile: string;
  maxDeploymentHistory: number;
  healthCheckTimeout: number;
  sshConnectionTimeout: number;
  sshRetryAttempts: number;
  dnsRetryAttempts: number;
  dnsRetryDelays: number[];
}

/**
 * Notification message types
 */
export type NotificationType =
  | 'deployment_started'
  | 'deployment_success'
  | 'deployment_failed'
  | 'rollback_executed';

/**
 * Notification message for deployment events
 *
 * @property type - Type of notification event
 * @property deploymentId - Unique deployment identifier
 * @property commitHash - Git commit SHA
 * @property commitMessage - Commit message text
 * @property author - Commit author
 * @property timestamp - Event timestamp
 * @property details - Additional event details
 * @property errorMessage - Error details if applicable
 */
export interface NotificationMessage {
  type: NotificationType;
  deploymentId: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: Date;
  details: string;
  errorMessage?: string;
}

/**
 * Deployment history containing multiple deployment records
 *
 * @property deployments - Array of deployment records
 * @property currentDeployment - Currently active deployment record
 */
export interface DeploymentHistory {
  deployments: DeploymentRecord[];
  currentDeployment: DeploymentRecord | null;
}

/**
 * DNS resolution result
 *
 * @property hostname - DNS hostname that was resolved
 * @property ipAddress - Resolved IP address
 * @property timestamp - When resolution occurred
 * @property attempts - Number of attempts required
 */
export interface DNSResolutionResult {
  hostname: string;
  ipAddress: string;
  timestamp: Date;
  attempts: number;
}

/**
 * SSH connection result
 *
 * @property success - Whether connection was successful
 * @property host - Target host (IP or hostname)
 * @property port - SSH port
 * @property user - SSH username
 * @property timestamp - Connection timestamp
 * @property errorMessage - Error details if connection failed
 */
export interface SSHConnectionResult {
  success: boolean;
  host: string;
  port: number;
  user: string;
  timestamp: Date;
  errorMessage?: string;
}

/**
 * Deployment step tracking individual operations
 *
 * @property name - Step name/identifier
 * @property startTime - When step started
 * @property endTime - When step completed
 * @property success - Whether step succeeded
 * @property output - Step output/logs
 * @property errorMessage - Error details if step failed
 */
export interface DeploymentStep {
  name: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  output: string;
  errorMessage?: string;
}
