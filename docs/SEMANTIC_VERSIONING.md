# Automatic Semantic Versioning

## Overview

Your bot now has **automatic version bumping** based on your commit messages. Every time you push to Development, the version automatically increases following semantic versioning rules.

## 🔢 Version Format

Versions follow the format: `MAJOR.MINOR.PATCH`

Example: `1.2.3`
- **1** = Major version (breaking changes)
- **2** = Minor version (new features)
- **3** = Patch version (bug fixes)

## 📝 Commit Message Format

Use these prefixes in your commit messages to control version bumping:

### Patch Version (1.0.0 → 1.0.1)

Bug fixes and small changes:

```bash
git commit -m "fix: resolve bot crash on startup"
git commit -m "fix: correct timezone calculation"
git commit -m "perf: improve database query speed"
git commit -m "refactor: simplify command handler"
```

**Triggers**: `fix:`, `perf:`, `refactor:`, `build:`

### Minor Version (1.0.0 → 1.1.0)

New features (backwards compatible):

```bash
git commit -m "feat: add new giveaway command"
git commit -m "feat: implement role sync with Kick"
git commit -m "feat: add chat rain rewards"
```

**Triggers**: `feat:`

### Major Version (1.0.0 → 2.0.0)

Breaking changes:

```bash
git commit -m "feat!: redesign command structure

BREAKING CHANGE: All commands now use slash commands only"

git commit -m "refactor!: change database schema

BREAKING CHANGE: Requires database migration"
```

**Triggers**: `!` after type OR `BREAKING CHANGE:` in body

### No Version Bump

Documentation and other changes:

```bash
git commit -m "docs: update README"
git commit -m "style: format code"
git commit -m "chore: update dependencies"
git commit -m "test: add unit tests"
git commit -m "ci: update workflow"
```

**No bump**: `docs:`, `style:`, `chore:`, `test:`, `ci:`

## 🚀 How It Works

1. **You commit with semantic message**:
   ```bash
   git commit -m "feat: add new moderation command"
   ```

2. **Push to Development**:
   ```bash
   git push origin Development
   ```

3. **CI runs tests** → Tests pass

4. **Auto-merge to release** → Triggers semantic-release

5. **Version automatically bumps**:
   - Reads commit messages since last release
   - Determines version bump type
   - Updates `package.json` version
   - Creates `CHANGELOG.md` entry
   - Creates GitHub release
   - Commits version bump back to release branch

6. **Deployment starts** with new version

7. **Discord notification shows**:
   ```
   🚀 New Release v1.1.0 - Deployment Starting
   Version: v1.1.0
   Commit: abc1234
   Author: your-name
   ```

## 📊 Version History Examples

### Starting from v1.0.0

```bash
# Bug fix
git commit -m "fix: resolve memory leak"
# → Version becomes 1.0.1

# New feature
git commit -m "feat: add announcement system"
# → Version becomes 1.1.0

# Another feature
git commit -m "feat: implement chat rain"
# → Version becomes 1.2.0

# Bug fix
git commit -m "fix: correct reward calculation"
# → Version becomes 1.2.1

# Multiple patches
git commit -m "fix: update dependencies"
# → Version becomes 1.2.2

# Breaking change
git commit -m "feat!: redesign API

BREAKING CHANGE: API endpoints changed"
# → Version becomes 2.0.0
```

## 📋 Commit Message Best Practices

### Good Commit Messages

✅ `feat: add user profile command`  
✅ `fix: resolve database connection timeout`  
✅ `perf: optimize message processing`  
✅ `refactor: simplify event handler logic`  
✅ `feat: implement role synchronization with Kick`

### Bad Commit Messages

❌ `update code`  
❌ `fix stuff`  
❌ `changes`  
❌ `wip`  
❌ `asdf`

### Detailed Commit Message

For complex changes, add a body:

```bash
git commit -m "feat: add advanced moderation system

- Implement spam detection
- Add automatic timeout system
- Create offense tracking
- Add punishment escalation

This feature provides comprehensive moderation tools
for managing Discord server behavior."
```

## 🎯 Commit Types Reference

| Type | Version Bump | Description | Example |
|------|--------------|-------------|---------|
| `feat:` | Minor (1.0.0 → 1.1.0) | New feature | `feat: add giveaway system` |
| `fix:` | Patch (1.0.0 → 1.0.1) | Bug fix | `fix: resolve crash on startup` |
| `perf:` | Patch (1.0.0 → 1.0.1) | Performance improvement | `perf: optimize database queries` |
| `refactor:` | Patch (1.0.0 → 1.0.1) | Code refactoring | `refactor: simplify command handler` |
| `build:` | Patch (1.0.0 → 1.0.1) | Build system changes | `build: update webpack config` |
| `docs:` | None | Documentation only | `docs: update API documentation` |
| `style:` | None | Code style/formatting | `style: format with prettier` |
| `test:` | None | Adding tests | `test: add unit tests for commands` |
| `chore:` | None | Maintenance tasks | `chore: update dependencies` |
| `ci:` | None | CI/CD changes | `ci: update GitHub Actions` |
| `revert:` | Patch (1.0.0 → 1.0.1) | Revert previous commit | `revert: undo feature X` |
| `feat!:` or `BREAKING CHANGE:` | Major (1.0.0 → 2.0.0) | Breaking change | `feat!: redesign command structure` |

## 📦 What Gets Generated

### 1. Updated package.json

```json
{
  "name": "tzbot-discord-bot",
  "version": "1.2.3",  // ← Automatically updated
  ...
}
```

### 2. CHANGELOG.md

```markdown
# Changelog

## [1.2.3](https://github.com/user/repo/compare/v1.2.2...v1.2.3) (2026-02-22)

### 🐛 Bug Fixes

* resolve database connection timeout ([abc1234](https://github.com/user/repo/commit/abc1234))
* correct reward calculation ([def5678](https://github.com/user/repo/commit/def5678))

## [1.2.0](https://github.com/user/repo/compare/v1.1.0...v1.2.0) (2026-02-21)

### ✨ Features

* add chat rain system ([ghi9012](https://github.com/user/repo/commit/ghi9012))
* implement role sync ([jkl3456](https://github.com/user/repo/commit/jkl3456))
```

### 3. GitHub Release

Automatically creates a GitHub release with:
- Release notes
- Changelog
- Tagged version

### 4. Discord Notification

```
🚀 New Release v1.2.3 - Deployment Starting
Version: v1.2.3
Commit: abc1234
Author: your-name
Estimated Time: ~2-3 minutes
```

## 🔍 Checking Current Version

### In Code

```typescript
import { version } from './package.json';
console.log(`Bot version: ${version}`);
```

### In Discord Bot

Add a version command:

```typescript
// In your bot
const version = require('../package.json').version;

client.on('messageCreate', (message) => {
  if (message.content === '!version') {
    message.reply(`TZBOT v${version}`);
  }
});
```

### On VPS

```bash
# Check deployed version
cat /var/www/tzbot/current/package.json | grep version

# Check PM2 info
pm2 info tzbot
```

## 🎉 Summary

**You just commit normally with semantic prefixes, and versions bump automatically!**

```bash
# Your workflow
git add .
git commit -m "feat: add cool new feature"
git push origin Development

# System automatically:
# 1. Runs tests
# 2. Merges to release
# 3. Bumps version (1.0.0 → 1.1.0)
# 4. Updates CHANGELOG.md
# 5. Creates GitHub release
# 6. Deploys to VPS
# 7. Notifies Discord with version number
```

**No manual version management needed!** 🚀
