# Git Branching Strategy & CI/CD Pipeline

## Branch Structure

### Main Branches

#### 1. `Development` (Default Branch)
- **Purpose**: Active development and integration
- **Protection**: CI checks must pass before merge
- **Deployment**: None (development only)
- **Naming**: `Development`

#### 2. `release` (Production Branch)
- **Purpose**: Production-ready code
- **Protection**: Requires PR approval + all CI checks pass
- **Deployment**: Auto-deploys to production on push
- **Naming**: `release`

### Supporting Branches

#### Feature Branches
- **Naming**: `feature/<feature-name>`
- **Example**: `feature/announcement-relay`, `feature/giveaway-system`
- **Base**: `Development`
- **Merge to**: `Development`
- **Lifetime**: Deleted after merge

#### Bugfix Branches
- **Naming**: `bugfix/<bug-description>`
- **Example**: `bugfix/channel-id-precision`
- **Base**: `Development`
- **Merge to**: `Development`
- **Lifetime**: Deleted after merge

#### Hotfix Branches
- **Naming**: `hotfix/<critical-fix>`
- **Example**: `hotfix/security-patch`
- **Base**: `release`
- **Merge to**: Both `release` AND `Development`
- **Lifetime**: Deleted after merge

## Workflow

### 1. Development Workflow

```bash
# Start new feature
git checkout Development
git pull origin Development
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push to remote
git push origin feature/my-feature

# Create Pull Request to Development
# CI will run automatically
```

### 2. Release Workflow

```bash
# When Development is stable and ready for production
git checkout release
git pull origin release
git merge Development

# Push to release (triggers production deployment)
git push origin release
```

### 3. Hotfix Workflow

```bash
# Critical bug in production
git checkout release
git pull origin release
git checkout -b hotfix/critical-fix

# Fix the issue
git add .
git commit -m "fix: critical security patch"

# Merge to release (production)
git checkout release
git merge hotfix/critical-fix
git push origin release

# Also merge to Development
git checkout Development
git merge hotfix/critical-fix
git push origin Development

# Delete hotfix branch
git branch -d hotfix/critical-fix
```

## CI/CD Pipeline

### Continuous Integration (CI)

Runs on every push to `Development` and `release` branches:

1. **Lint & Type Check**
   - ESLint validation
   - TypeScript type checking
   - Code style verification

2. **Testing**
   - Unit tests
   - Property-based tests
   - Integration tests
   - Coverage reporting

3. **Build**
   - TypeScript compilation
   - Build artifact generation
   - Validation checks

4. **Security Scan**
   - npm audit
   - Dependency vulnerability scan
   - Security best practices check

### Continuous Deployment (CD)

Runs only on push to `release` branch:

1. **Pre-deployment**
   - All CI checks must pass
   - Build production artifacts
   - Run production tests

2. **Deployment**
   - Deploy to production environment
   - Database migrations (if needed)
   - Environment configuration

3. **Post-deployment**
   - Health checks
   - Smoke tests
   - Monitoring verification

## Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes

### Examples
```bash
feat(giveaway): add winner confirmation system
fix(database): preserve Discord ID precision
docs(readme): update deployment instructions
test(property): add reroll winner selection tests
ci(workflow): add security scanning step
```

## Pull Request Guidelines

### PR Title Format
```
<type>: <description>
```

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests pass locally
```

## Branch Protection Rules

### Development Branch
- ✅ Require pull request reviews (1 approval)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators
- ❌ Allow force pushes

### Release Branch
- ✅ Require pull request reviews (2 approvals)
- ✅ Require status checks to pass
- ✅ Require branches to be up to date
- ✅ Include administrators
- ❌ Allow force pushes
- ✅ Require deployment approval

## Environment Variables

### Development
- Stored in `.env` (not committed)
- Use `.env.example` as template

### Production
- Stored in CI/CD secrets
- Never commit to repository
- Managed through hosting platform

## Deployment Checklist

Before merging to `release`:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Documentation updated
- [ ] Database migrations tested
- [ ] Environment variables configured
- [ ] Rollback plan prepared
- [ ] Monitoring alerts configured
- [ ] Team notified of deployment

## Rollback Procedure

If deployment fails:

1. Immediately revert the merge commit on `release`
2. Push the revert to trigger rollback deployment
3. Investigate the issue on `Development`
4. Fix and re-test before next release attempt

```bash
# Rollback command
git revert <commit-hash>
git push origin release
```

## Monitoring & Alerts

After deployment to production:

- Monitor error logs for 30 minutes
- Check application metrics
- Verify all critical features working
- Monitor database performance
- Check API response times

## Support

For questions about the branching strategy or CI/CD pipeline:
- Check this document first
- Review GitHub Actions logs
- Contact the development team
