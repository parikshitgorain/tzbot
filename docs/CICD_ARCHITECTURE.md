# CI/CD Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DEVELOPMENT ENVIRONMENT                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ git push
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEVELOPMENT BRANCH (development)                     │
│  Contains: Source code, Tests, Dev configs, Documentation                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Trigger: Push/PR
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CI WORKFLOW (Automated)                             │
│  File: .github/workflows/ci-development.yml                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 1: Code Quality & Security                               │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • ESLint (code style)                                          │        │
│  │ • TypeScript type checking                                     │        │
│  │ • npm audit (vulnerability scan)                               │        │
│  │ • Check outdated packages                                      │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Pass                                          │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 2: Testing                                               │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Unit tests                                                   │        │
│  │ • Property-based tests                                         │        │
│  │ • Code coverage                                                │        │
│  │ • Upload to Codecov                                            │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Pass                                          │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 3: Build Verification                                    │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Build TypeScript → JavaScript                                │        │
│  │ • Verify dist/ directory                                       │        │
│  │ • Verify entry point                                           │        │
│  │ • Upload build artifacts                                       │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Pass                                          │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 4: Prepare Clean Production Build                        │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Copy production files only                                   │        │
│  │ • Remove ALL dev artifacts:                                    │        │
│  │   - tests/ directory                                           │        │
│  │   - *.test.ts files                                            │        │
│  │   - vitest.config.ts                                           │        │
│  │   - eslint.config.js                                           │        │
│  │   - Dev documentation                                          │        │
│  │ • Upload clean artifact                                        │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Pass                                          │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 5: Auto-Promote to Release                               │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Download clean build                                         │        │
│  │ • Checkout release branch                                      │        │
│  │ • Replace entire branch with clean build                       │        │
│  │ • Strip -dev suffix from version                               │        │
│  │ • Force push to release                                        │        │
│  │ • Send Discord notification                                    │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Auto-promote
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RELEASE BRANCH (release)                             │
│  Contains: Built code (dist/), Production deps, Deployment scripts          │
│  Does NOT contain: Tests, Dev configs, Dev docs, Example files              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Trigger: Push
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      RELEASE WORKFLOW (Automated)                            │
│  File: .github/workflows/release-versioning.yml                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 1: Validate Release Branch                               │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Verify on release branch                                     │        │
│  │ • Check for dev artifacts (warn)                               │        │
│  │ • Extract version from package.json                            │        │
│  │ • Ensure no -dev suffix                                        │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Valid                                         │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 2: Semantic Versioning                                   │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Check commits since last tag                                 │        │
│  │ • Analyze commit messages:                                     │        │
│  │   - feat: → Minor bump (1.0.0 → 1.1.0)                         │        │
│  │   - fix: → Patch bump (1.0.0 → 1.0.1)                          │        │
│  │   - feat!: → Major bump (1.0.0 → 2.0.0)                        │        │
│  │ • Bump version with npm                                        │        │
│  │ • Commit and push                                              │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Version bumped                                │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 3: Create Git Tag & GitHub Release                       │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Create Git tag (v1.2.3)                                      │        │
│  │ • Push tag to GitHub                                           │        │
│  │ • Generate changelog:                                          │        │
│  │   - Features                                                   │        │
│  │   - Bug Fixes                                                  │        │
│  │   - Other Changes                                              │        │
│  │ • Create GitHub Release                                        │        │
│  │ • Send Discord notification                                    │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ Trigger: Push/Release
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CD WORKFLOW (Automated)                                │
│  File: .github/workflows/cd-production.yml                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 1: Pre-Deployment Validation                             │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Verify from release branch                                   │        │
│  │ • Extract version                                              │        │
│  │ • Determine environment                                        │        │
│  │ • Check for dev artifacts (warn)                               │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Valid                                         │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 2: Prepare Deployment                                    │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ • Verify dist/ exists                                          │        │
│  │ • Create deployment record                                     │        │
│  │ • Generate summary                                             │        │
│  └────────────────────────────────────────────────────────────────┘        │
│                              │                                               │
│                              │ Ready                                         │
│                              ▼                                               │
│  ┌────────────────────────────────────────────────────────────────┐        │
│  │ STAGE 3: Deploy to VPS                                         │        │
│  ├────────────────────────────────────────────────────────────────┤        │
│  │ 1. Send deployment start notification (Discord)                │        │
│  │ 2. Resolve VPS IP address                                      │        │
│  │ 3. Setup SSH connection                                        │        │
│  │ 4. Test SSH connection                                         │        │
│  │ 5. Initialize VPS deployment directory                         │        │
│  │ 6. Setup environment variables (.env)                          │        │
│  │ 7. Execute deploy