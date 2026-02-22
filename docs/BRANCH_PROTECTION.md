# Branch Protection Setup

This document explains how to protect the `release` branch to ensure only automated processes can push to it.

## Overview

The `release` branch should be protected to prevent accidental or unauthorized pushes. Only the automated promote workflow should be able to update this branch.

## GitHub Branch Protection Rules

### Step 1: Navigate to Branch Protection Settings

1. Go to your GitHub repository: `https://github.com/parikshitgorain/tzbot`
2. Click on **Settings** tab
3. Click on **Branches** in the left sidebar
4. Under "Branch protection rules", click **Add rule** or **Add branch protection rule**

### Step 2: Configure Protection for `release` Branch

**Branch name pattern:** `release`

#### Required Settings

1. **Require a pull request before merging**
   - ✅ Enable this
   - Uncheck "Require approvals" (since automated workflow will merge)
   
2. **Require status checks to pass before merging**
   - ✅ Enable this
   - ✅ Require branches to be up to date before merging
   - Add required status checks:
     - `validate` (from promote workflow)
     - `build` (from CI workflow)
     - `test` (from CI workflow)

3. **Require conversation resolution before merging**
   - ⬜ Optional - can leave unchecked for automated workflow

4. **Require signed commits**
   - ⬜ Optional - depends on your security requirements

5. **Require linear history**
   - ✅ Enable this to keep clean history

6. **Do not allow bypassing the above settings**
   - ✅ Enable this
   - **Exception:** Add `github-actions[bot]` to the list of users who can bypass

7. **Restrict who can push to matching branches**
   - ✅ Enable this
   - **Add:** `github-actions[bot]` (the automated workflow)
   - **Do NOT add:** Individual users (including yourself)

8. **Allow force pushes**
   - ⬜ Disable this (unchecked)

9. **Allow deletions**
   - ⬜ Disable this (unchecked)

### Step 3: Save Protection Rules

Click **Create** or **Save changes** at the bottom of the page.

## Workflow Configuration

### Update Promote Workflow Permissions

The promote workflow needs write permissions to push to the `release` branch. This is already configured in `.github/workflows/promote.yml`:

```yaml
permissions:
  contents: write  # Required to push to release branch
  pull-requests: write  # Required to create PRs
```

### GitHub Token Authentication

The workflow uses `GITHUB_TOKEN` which is automatically provided by GitHub Actions. This token has the necessary permissions when the workflow runs.

## How It Works

### Normal Development Flow

1. Developers work on `Development` branch
2. Push changes to `Development`
3. CI runs tests and builds
4. When ready, run the promote workflow manually
5. Promote workflow:
   - Validates the changes
   - Creates a merge to `release` branch
   - Pushes to `release` (allowed because it's `github-actions[bot]`)
6. CD workflow automatically deploys from `release`

### What's Blocked

- ❌ Direct pushes to `release` by developers
- ❌ Force pushes to `release`
- ❌ Deleting the `release` branch
- ❌ Bypassing status checks
- ✅ Only automated workflow can push

## Emergency Override

If you need to manually push to `release` in an emergency:

1. Temporarily disable branch protection
2. Make your changes
3. Re-enable branch protection immediately

**Note:** This should be avoided. Use the promote workflow instead.

## Verification

To verify the protection is working:

1. Try to push directly to `release`:
   ```bash
   git checkout release
   git push origin release
   ```
   
2. You should see an error:
   ```
   remote: error: GH006: Protected branch update failed for refs/heads/release.
   remote: error: Required status check "validate" is expected.
   ```

3. This confirms the protection is active.

## Alternative: Use GitHub Actions Environment

For additional security, you can also use GitHub Environments:

1. Go to **Settings** → **Environments**
2. Create environment named `production`
3. Add protection rules:
   - Required reviewers (optional)
   - Wait timer (optional)
   - Deployment branches: Only `release`

This adds an extra layer of approval for deployments.

## Summary

With these settings:
- ✅ `release` branch is protected
- ✅ Only automated promote workflow can push
- ✅ All changes must go through `Development` → `release` flow
- ✅ Prevents accidental production deployments
- ✅ Maintains clean git history

## Troubleshooting

### Workflow fails with "protected branch" error

**Solution:** Ensure `github-actions[bot]` is added to the bypass list in branch protection settings.

### Can't merge from promote workflow

**Solution:** Check that the workflow has `contents: write` permission in the YAML file.

### Status checks not appearing

**Solution:** Run the CI workflow at least once so GitHub knows about the status checks, then add them to required checks.
