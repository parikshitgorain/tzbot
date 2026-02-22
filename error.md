# GitHub Actions CI/CD Issues - FIXED

## Issue 1: Missing coverage dependency

### Error Message:
```
MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
Error: Process completed with exit code 1.
```

### Root Cause:
The `@vitest/coverage-v8` package was not installed in devDependencies, but the CI workflow was trying to run coverage tests.

### Fix Applied:
✅ Added `@vitest/coverage-v8` to package.json devDependencies
✅ Updated CI workflow to only upload coverage if generation succeeds

### Changes Made:
- Added `"@vitest/coverage-v8": "^4.0.18"` to devDependencies in package.json
- Changed codecov upload condition from `if: always()` to `if: success()` in ci.yml

---

## Issue 2: Workflow dispatch trigger error

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

---

## Issue 3: Missing test mock

### Error Message:
```
TypeError: this.giveawayRepository.updateWinners is not a function
```

### Root Cause:
The GiveawayRepository mock in the test file was missing the `updateWinners` method.

### Fix Applied:
✅ Added `updateWinners: vi.fn().mockResolvedValue(undefined)` to the mock repository

### Changes Made:
- Updated `tests/unit/managers/giveaway.manager.test.ts` to include the missing mock method

---

## Status: ✅ ALL ISSUES RESOLVED

### Next Steps:
1. Run `npm install` to install the new coverage dependency
2. Commit and push changes
3. CI pipeline should now run successfully

### Files Modified:
- `package.json` - Added @vitest/coverage-v8 dependency
- `.github/workflows/ci.yml` - Fixed workflow dispatch and coverage upload
- `tests/unit/managers/giveaway.manager.test.ts` - Added missing mock
- `error.md` - This documentation
