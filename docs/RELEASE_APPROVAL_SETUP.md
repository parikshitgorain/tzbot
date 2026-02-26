# Release Approval Setup

This guide explains how to configure manual approval for production releases.

## Overview

After the CI pipeline passes on the Development branch, the promotion to Release (which triggers production deployment) now requires manual approval. This prevents accidental production deployments.

## Setup GitHub Environment Protection

You need to configure a GitHub environment with required reviewers:

### Step 1: Create Environment

1. Go to your repository on GitHub
2. Click **Settings** → **Environments**
3. Click **New environment**
4. Name it: `release-promotion`
5. Click **Configure environment**

### Step 2: Add Protection Rules

1. Check **Required reviewers**
2. Add yourself and/or team members who can approve releases
3. (Optional) Set **Wait timer** to 0 minutes
4. Click **Save protection rules**

### Step 3: Test the Setup

1. Push a commit to Development branch
2. Wait for CI to complete
3. The "Promote to Release" job will pause and wait for approval
4. Go to Actions → Click the workflow run → Click "Review deployments"
5. Approve or reject the promotion

## Workflow Behavior

### Before Approval Setup
- Push to Development → CI passes → Auto-promotes to Release → Production deployment starts

### After Approval Setup
- Push to Development → CI passes → **Waits for approval** → Promote to Release → Production deployment starts

## Approval Process

When CI completes successfully:

1. You'll receive a notification (if configured)
2. Go to the Actions tab
3. Find the workflow run
4. Click "Review deployments" button
5. Review the changes
6. Click "Approve and deploy" or "Reject"

## Bypass Approval (Emergency)

If you need to bypass approval for urgent fixes:

1. Use `workflow_dispatch` to manually trigger the promotion
2. Or temporarily remove the `environment` section from the workflow

## Alternative: Disable Auto-Promotion

If you want to completely disable auto-promotion and manually promote:

1. Comment out or remove the `auto-promote` job in `.github/workflows/ci-development.yml`
2. Manually run the promotion script when ready:
   ```bash
   ./deployment/scripts/promote_to_release.sh
   ```

## Notifications

The workflow will send Discord notifications at these stages:
- ✅ CI Pipeline Success (Development)
- ⏸️ Waiting for Release Approval
- ✅ Promoted to Release
- 🚀 Production Deployment Started

## Troubleshooting

### "Environment not found" error
- Make sure you created the environment named exactly `release-promotion`
- Check that the environment is configured in repository settings

### No approval button appears
- Ensure you're added as a required reviewer
- Check that the workflow is using the correct environment name

### Want to skip approval for specific commits
Add `[skip promotion]` to your commit message to skip the auto-promote job entirely.

## Security Considerations

- Only trusted team members should be added as reviewers
- Review the changes carefully before approving
- Check the Discord notification for what's being deployed
- Verify tests passed before approving

## Related Documentation

- [CI/CD Architecture](./CICD_ARCHITECTURE.md)
- [Production Deployment Guide](./CICD_PRODUCTION_GUIDE.md)
- [Quick Reference](./CICD_QUICK_REFERENCE.md)
