# Implementation Plan: CI/CD Auto-Deployment System

## Overview

This implementation plan breaks down the CI/CD auto-deployment system into discrete coding tasks. The system will use GitHub Actions for CI/CD orchestration, shell scripts for VPS deployment operations, and TypeScript for health checks and utilities. Tasks are ordered to build incrementally, with testing integrated throughout.

## Tasks

- [x] 1. Set up project structure and configuration files
  - Create `.github/workflows/` directory for GitHub Actions workflows
  - Create `deployment/` directory for deployment scripts
  - Create configuration file for VPS settings (hostname, paths, service name)
  - Set up TypeScript types for deployment records and configurations
  - _Requirements: 8.1, 10.1_

- [ ] 2. Implement CI Pipeline workflow
  - [x] 2.1 Create GitHub Actions workflow file for CI (`ci.yml`)
    - Configure trigger on push to development branch
    - Set up Node.js environment and dependency installation
    - Add TypeScript build step
    - Add test execution step
    - Configure test result reporting
    - _Requirements: 1.1, 1.2_
  
  - [ ]* 2.2 Write property test for CI pipeline execution
    - **Property 1: CI Pipeline Execution on Push**
    - **Validates: Requirements 1.1, 1.2**
  
  - [x] 2.3 Add conditional logic for promotion trigger
    - Check test results status
    - Trigger branch promotion workflow on success
    - Prevent promotion on test failure
    - _Requirements: 1.3, 1.4_
  
  - [ ]* 2.4 Write property test for promotion prevention
    - **Property 2: Promotion Prevention on Test Failure**
    - **Validates: Requirements 1.3**

- [ ] 3. Implement Branch Promoter workflow
  - [x] 3.1 Create GitHub Actions workflow file for promotion (`promote.yml`)
    - Configure trigger from CI workflow success
    - Set up git configuration with credentials
    - Implement merge logic from development to release branch
    - Add commit history preservation
    - Handle merge conflicts with notifications
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [ ]* 3.2 Write property test for automatic promotion
    - **Property 3: Automatic Branch Promotion on Success**
    - **Validates: Requirements 1.4, 2.1, 2.2**
  
  - [x] 3.3 Add deployment workflow trigger
    - Trigger deployment workflow on successful merge
    - Pass commit information to deployment workflow
    - _Requirements: 2.4_
  
  - [ ]* 3.4 Write property test for deployment trigger
    - **Property 4: Deployment Trigger on Release Update**
    - **Validates: Requirements 2.4**

- [x] 4. Checkpoint - Ensure CI and promotion workflows are functional
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Dynamic DNS resolution utility
  - [x] 5.1 Create DNS resolution script
    - Implement DNS lookup using `dig` or `nslookup`
    - Add retry logic with exponential backoff (5 attempts)
    - Calculate backoff delays (1s, 2s, 4s, 8s, 16s)
    - Log each resolution attempt
    - Return resolved IP address or error
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ]* 5.2 Write property test for DNS resolution
    - **Property 5: Dynamic DNS Resolution**
    - **Validates: Requirements 3.1, 3.2**
  
  - [ ]* 5.3 Write property test for retry logic
    - **Property 6: DNS Retry with Exponential Backoff**
    - **Validates: Requirements 3.3**
  
  - [x] 5.4 Add error handling for DNS failures
    - Abort deployment on exhausted retries
    - Log failure details
    - _Requirements: 3.4_

- [x] 6. Implement SSH connection and authentication
  - [x] 6.1 Create SSH connection utility script
    - Load SSH private key from environment/secrets
    - Establish SSH connection with key authentication
    - Set connection timeout (30 seconds)
    - Implement retry logic (3 attempts)
    - Verify connection success
    - _Requirements: 4.1_
  
  - [ ]* 6.2 Write property test for SSH authentication
    - **Property 7: SSH Key Authentication**
    - **Validates: Requirements 4.1**
  
  - [x] 6.3 Implement secure file transfer function
    - Use rsync over SSH for file transfer
    - Verify encrypted protocol usage
    - Add progress logging
    - _Requirements: 4.3_
  
  - [ ]* 6.4 Write property test for encrypted transfer
    - **Property 8: Encrypted File Transfer**
    - **Validates: Requirements 4.3**
  
  - [x] 6.5 Add credential security checks
    - Ensure no plaintext credentials in logs
    - Mask sensitive data in output
    - _Requirements: 4.4_
  
  - [ ]* 6.6 Write property test for credential security
    - **Property 9: No Plaintext Credentials**
    - **Validates: Requirements 4.4**

- [x] 7. Implement deployment script for VPS
  - [x] 7.1 Create main deployment script (`deploy.sh`)
    - Accept commit hash and timestamp as parameters
    - Create timestamped release directory
    - Pull latest code from release branch
    - Install dependencies with `npm ci`
    - Build TypeScript application with `npm run build`
    - Create symlink to new release as `current`
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 7.2 Add service management to deployment script
    - Stop current application service (PM2 or systemd)
    - Update `current` symlink to new release
    - Start application service
    - Wait for service initialization (configurable delay)
    - _Requirements: 5.4, 5.5_
  
  - [ ]* 7.3 Write property test for deployment pipeline ordering
    - **Property 10: Deployment Pipeline Ordering**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [x] 8. Implement health check system
  - [x] 8.1 Create health check script (`health-check.sh`)
    - Check if application process is running (PM2 list or systemd status)
    - Verify process has expected PID and status
    - Log health check results
    - _Requirements: 6.1_
  
  - [x] 8.2 Add Discord connection health check
    - Create TypeScript utility to check Discord bot connection status
    - Verify bot is connected to Discord API
    - Check WebSocket status
    - Return connection status
    - _Requirements: 6.2_
  
  - [ ]* 8.3 Write property test for health check execution
    - **Property 11: Health Check Execution**
    - **Validates: Requirements 6.1, 6.2**
  
  - [x] 8.4 Implement health check orchestration
    - Run all health checks in sequence
    - Wait up to 60 seconds for checks to pass
    - Mark deployment success if all checks pass
    - Mark deployment failed if any check fails
    - _Requirements: 6.3, 6.4_
  
  - [ ]* 8.5 Write property test for deployment status
    - **Property 12: Deployment Status Based on Health Checks**
    - **Validates: Requirements 6.3, 6.4**

- [ ] 9. Checkpoint - Ensure deployment and health checks work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement rollback system
  - [x] 10.1 Create rollback script (`rollback.sh`)
    - Accept target commit hash or "previous" as parameter
    - Stop current application service
    - Update `current` symlink to target release
    - Restart application service
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 10.2 Add rollback verification
    - Run health checks on restored version
    - Verify restored version passes checks
    - Log rollback success or failure
    - _Requirements: 7.5_
  
  - [ ]* 10.3 Write property test for automatic rollback
    - **Property 14: Automatic Rollback on Health Check Failure**
    - **Validates: Requirements 7.1**
  
  - [ ]* 10.4 Write property test for rollback pipeline
    - **Property 15: Rollback Pipeline Ordering**
    - **Validates: Requirements 7.2, 7.3, 7.4, 7.5**
  
  - [x] 10.5 Add critical failure handling
    - Detect rollback failures
    - Send critical alerts
    - Log failure details for manual intervention
    - _Requirements: 7.6_

- [x] 11. Implement deployment state management
  - [x] 11.1 Create deployment record data structure
    - Define TypeScript interface for DeploymentRecord
    - Implement serialization to JSON
    - Create storage file on VPS (`deployment-history.json`)
    - _Requirements: 8.1, 8.2_
  
  - [x] 11.2 Add deployment recording functions
    - Record deployment start with commit hash, timestamp, user
    - Update record with final status on completion
    - Append record to deployment history
    - _Requirements: 8.1, 8.2_
  
  - [ ]* 11.3 Write property test for deployment records
    - **Property 16: Complete Deployment Records**
    - **Validates: Requirements 8.1, 8.2**
  
  - [x] 11.4 Implement deployment history management
    - Maintain last 10 deployments in history
    - Prune older deployments automatically
    - _Requirements: 8.3_
  
  - [ ]* 11.5 Write property test for history retention
    - **Property 17: Deployment History Retention**
    - **Validates: Requirements 8.3**
  
  - [x] 11.6 Add current deployment query function
    - Read current symlink target
    - Extract commit hash from directory name
    - Return deployment timestamp and commit info
    - _Requirements: 8.4_
  
  - [ ]* 11.7 Write property test for deployment query
    - **Property 18: Current Deployment Query**
    - **Validates: Requirements 8.4**
  
  - [x] 11.8 Implement deployment logging
    - Create log file for each deployment
    - Store logs in deployment directory
    - Include all deployment steps and outputs
    - _Requirements: 8.5_
  
  - [ ]* 11.9 Write property test for log persistence
    - **Property 19: Deployment Log Persistence**
    - **Validates: Requirements 8.5**

- [x] 12. Implement notification system
  - [x] 12.1 Create notification utility
    - Define NotificationMessage interface
    - Implement Discord webhook sender
    - Format messages with embeds and colors
    - Add retry logic for failed sends
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 12.2 Integrate notifications into deployment workflow
    - Send notification on deployment start
    - Send notification on deployment success with commit details
    - Send notification on deployment failure with errors
    - Send notification on rollback with restored version
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 12.3 Write property test for deployment notifications
    - **Property 13: Deployment Notifications**
    - **Validates: Requirements 6.5, 9.1, 9.2, 9.3, 9.4**
  
  - [x] 12.4 Add graceful degradation for notification failures
    - Log notification failures
    - Continue deployment on notification failure
    - Don't block deployment operations
    - _Requirements: 9.5_
  
  - [ ]* 12.5 Write property test for notification failure handling
    - **Property 20: Notification Failure Graceful Degradation**
    - **Validates: Requirements 9.5**

- [x] 13. Implement Deployment Orchestrator workflow
  - [x] 13.1 Create GitHub Actions workflow file for deployment (`deploy.yml`)
    - Configure trigger on release branch push
    - Load secrets (SSH key, DNS hostname, webhook URL)
    - Resolve VPS IP using DNS utility
    - Establish SSH connection to VPS
    - Execute deployment script remotely
    - Monitor deployment progress
    - _Requirements: 5.1, 10.2_
  
  - [x] 13.2 Add health check execution to workflow
    - Wait for deployment script completion
    - Execute health check script remotely
    - Capture health check results
    - Determine deployment success/failure
    - _Requirements: 6.3, 6.4_
  
  - [x] 13.3 Add rollback trigger to workflow
    - Detect health check failures
    - Execute rollback script remotely
    - Verify rollback success
    - _Requirements: 7.1_
  
  - [x] 13.4 Integrate notifications into workflow
    - Send deployment start notification
    - Send success/failure notifications
    - Send rollback notifications
    - Handle notification errors gracefully
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 14. Add webhook authentication and validation
  - [x] 14.1 Implement webhook authentication
    - Verify GitHub webhook signatures
    - Use shared secret for validation
    - Reject unauthenticated requests
    - _Requirements: 10.3_
  
  - [x] 14.2 Add branch validation
    - Extract source branch from webhook payload
    - Verify branch matches Release_Branch
    - Reject deployments from other branches
    - _Requirements: 10.4_
  
  - [ ]* 14.3 Write property test for webhook authentication
    - **Property 21: Webhook Authentication**
    - **Validates: Requirements 10.2, 10.3, 10.4**
  
  - [x] 14.4 Add security logging
    - Log all webhook requests
    - Log authentication failures
    - Log rejected requests with reasons
    - _Requirements: 10.5_

- [x] 15. Create setup and configuration documentation
  - [x] 15.1 Document VPS setup requirements
    - SSH key generation and installation
    - Dynamic DNS service configuration
    - PM2 or systemd service setup
    - Directory structure creation
    - Firewall configuration
  
  - [x] 15.2 Document GitHub repository setup
    - Required secrets configuration
    - Branch protection rules
    - Workflow permissions
  
  - [x] 15.3 Create deployment troubleshooting guide
    - Common failure scenarios
    - Log locations and interpretation
    - Manual rollback procedures
    - Emergency recovery steps

- [ ] 16. Final checkpoint - End-to-end testing
  - Test complete workflow from dev push to production deployment
  - Verify rollback functionality
  - Verify notifications are sent correctly
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across many inputs
- Unit tests validate specific examples and edge cases
- GitHub Actions workflows can be tested locally using the `act` tool
- VPS deployment scripts should be tested in a Docker container before production use
