# GitHub Actions Workflow Issues - FIXED

## Issue: Workflow dispatch trigger error

### Error Message:
```
Failed to trigger promotion workflow: Workflow does not have 'workflow_dispatch' trigger
RequestError [HttpError]: Workflow does not have 'workflow_dispatch' trigger
status: 422
```

### Root Cause:
The CI workflow was trying to trigger the promote.yml workflow using the filename string `'promote.yml'` instead of the workflow ID. GitHub Actions requires either:
1. The workflow ID (numeric)
2. The workflow to exist on the branch being referenced

### Fix Applied:
✅ Updated `.github/workflows/ci.yml` to:
1. First query the repository to find the promote.yml workflow
2. Extract the workflow ID from the API response
3. Use the workflow ID instead of filename when triggering the dispatch
4. Added better error handling and logging

### Changes Made:
- Modified the "Trigger promotion workflow" step in `ci.yml`
- Added workflow discovery logic using `github.rest.actions.listRepoWorkflows()`
- Changed from using `workflow_id: 'promote.yml'` to `workflow_id: promoteWorkflow.id`
- Enhanced error messages for better debugging

### Verification:
The promote.yml workflow already has the correct `workflow_dispatch` trigger configured with all required inputs:
- source_branch
- target_branch  
- commit_sha
- commit_author

### Status: ✅ RESOLVED

The workflow should now trigger correctly when CI passes on the Development branch.
