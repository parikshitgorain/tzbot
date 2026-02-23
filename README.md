# TZBOT Discord Bot

A comprehensive Discord moderation and engagement bot with Kick.com integration, featuring automated moderation, role synchronization, giveaways, and CI/CD auto-deployment.

## Features

### Core Features
- **Live Notifications**: Real-time notifications from Kick.com with premium embeds
- **Automated Role Sync**: Automatic subscriber/VIP role assignment based on Kick status
- **Advanced Moderation**: Progressive spam punishment system with automatic escalation
- **Slash Commands**: Fast-action moderation commands (/ban, /timeout, /warn, /kick)
- **Announcement Relay**: Private-to-public announcement system with multi-channel support
- **Phishing Detection**: Advanced link scanning with Google Safe Browsing integration
- **Giveaway System**: Interactive button-based giveaways with role restrictions and CSPRNG winner selection
- **Chat Rain**: Algorithmic reward system for active chatters
- **Channel Text Rate Limiting**: Prevent spam with configurable rate limits per channel

### DevOps Features
- **CI/CD Pipeline**: Automated testing and deployment on every push
- **Auto-Deployment**: Push to release branch triggers automatic VPS deployment
- **Health Checks**: Automatic health verification after deployment
- **Rollback System**: Automatic rollback on deployment failure
- **Discord Notifications**: Real-time deployment status notifications

## Requirements

### Runtime Requirements
- Node.js 18.0.0 or higher
- PostgreSQL 15+ (Neon Postgres supported)
- Redis 7+ (optional, for caching)
- Discord Bot Token

### Optional Integrations
- Kick.com Developer Account (for role sync)
- Google Safe Browsing API Key (for link scanning)

### Development Requirements
- TypeScript 5.0+
- Vitest (for testing)
- ESLint & Prettier (for code quality)

## Quick Start

For a quick setup guide, see [Quick Start Guide](docs/QUICK_START.md).

### Basic Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd tzbot-discord-bot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env and fill in your configuration values
```

4. **Set up database:**
```bash
# Run migrations
npm run migrate
```

5. **Build the project:**
```bash
npm run build
```

6. **Start the bot:**
```bash
# Development mode with hot reload
npm run dev

# Production mode
npm start
```

For production deployment with CI/CD, systemd, monitoring, and backups, see the [Deployment Guide](docs/DEPLOYMENT.md) and [CI/CD Setup Guide](docs/CICD_SETUP.md).

## Development

### Development Mode
Run in development mode with hot reload:
```bash
npm run dev
```

### Testing
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit           # Unit tests only
npm run test:property       # Property-based tests
npm run test:integration    # Integration tests

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

### Code Quality
```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck

# Run all checks
npm run validate
```

### CI/CD Pipeline

The project includes a production-grade CI/CD pipeline with strict quality gates and zero-downtime deployment:

#### Pipeline Stages

**1. Development → Release Promotion (CI)**
- Runs on every push to `development` branch
- Quality gates: Lint, TypeScript check, Security scan, Tests
- Automated cleanup: Removes all dev/test files, mock files, logs, debug configs
- Creates clean production bundle with ONLY production-ready files
- Auto-promotes to `release` branch only if all checks pass

**2. Release Versioning**
- Runs on every push to `release` branch
- Analyzes commit messages for semantic versioning (major/minor/patch)
- Prevents duplicate tags
- Creates Git tag (vX.Y.Z)
- Generates changelog from conventional commits
- Creates GitHub Release with full changelog

**3. Production Deployment (CD)**
- Runs on `release` branch push or version tag
- Requires GitHub Environment approval for production
- Zero-downtime deployment with versioned releases (/releases/vX.Y.Z)
- Deployment locking prevents concurrent deploys
- SSH with proper host verification (no StrictHostKeyChecking=no)
- Health check validation after deployment
- Automatic rollback to previous version on failure
- PM2 process management with graceful restart

#### Branch Strategy

```
development (dev work)
    ↓
    CI Pipeline (lint, test, security, build)
    ↓
    Clean Production Build (remove dev files)
    ↓
release (production-ready only)
    ↓
    Semantic Versioning (auto bump, create tag)
    ↓
    VPS Deployment (zero-downtime)
    ↓
production (live on VPS)
```

#### Deployment Workflow

```
Push to development
    ↓
✓ Lint & Type Check
✓ Security Scan
✓ Unit Tests
✓ Build Verification
    ↓
Clean Production Build
    ↓
Auto-Promote to release
    ↓
Semantic Version Bump
Create Git Tag (vX.Y.Z)
Create GitHub Release
    ↓
Deploy to VPS
    ├─ Versioned release directory
    ├─ Symlink switch (zero-downtime)
    ├─ PM2 graceful restart
    └─ Health check validation
        ↓
    ✓ Success → Live
    ✗ Failure → Automatic Rollback
```

#### Key Features

- **Strict Quality Gates**: No promotion without passing all checks
- **Clean Releases**: Zero dev artifacts in production
- **Safe Versioning**: Duplicate tag prevention, semantic versioning
- **Zero-Downtime**: Symlink switching, graceful restarts
- **Automatic Rollback**: Instant recovery on deployment failure
- **Deployment Locking**: Prevents concurrent deployments
- **SSH Security**: Proper host verification, no hardcoded keys
- **Health Validation**: Automated health checks post-deployment
- **Discord Notifications**: Real-time deployment status updates

See [CI/CD Setup Guide](docs/CICD_SETUP.md) for configuration details.

## Configuration

All configuration is done through environment variables. See `.env.example` for all available options.

### Required Configuration

**Discord:**
- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_GUILD_ID`: Your Discord server ID
- `DISCORD_CLIENT_ID`: Your Discord application client ID

**Roles:**
- `SUBSCRIBER_ROLE_ID`: Role ID for subscribers
- `VIP_ROLE_ID`: Role ID for VIPs
- `MODERATOR_ROLE_ID`: Role ID for moderators

**Channels:**
- `NOTIFICATION_CHANNEL_ID`: Channel for notifications

**Database:**
- `DATABASE_URL`: PostgreSQL connection string (Neon Postgres supported)

**Redis (Optional):**
- `REDIS_URL`: Redis connection string (optional, for caching)

### Optional Configuration

**Kick.com Integration:**
- `KICK_API_KEY`: Kick API key
- `KICK_CHANNEL_ID`: Kick channel ID
- `KICK_OAUTH_CLIENT_ID`: OAuth client ID
- `KICK_OAUTH_CLIENT_SECRET`: OAuth client secret

**Google Safe Browsing:**
- `GOOGLE_SAFE_BROWSING_API_KEY`: API key for link scanning

**Chat Rain:**
- `CHAT_RAIN_ENABLED`: Enable/disable chat rain feature
- `CHAT_RAIN_MIN_DELAY`: Minimum delay between events
- `CHAT_RAIN_ACTIVE_WINDOW`: Time window for tracking activity
- `CHAT_RAIN_MIN_MESSAGES`: Minimum messages for eligibility

For complete configuration details, see [Deployment Guide](docs/DEPLOYMENT.md).

## Project Structure

```
tzbot/
├── .github/                # GitHub workflows (CI/CD)
│   └── workflows/
│       ├── ci.yml         # Continuous Integration
│       ├── cd-release.yml # Continuous Deployment
│       └── promote.yml    # Branch promotion
├── .kiro/                 # Kiro specs
│   └── specs/
├── deployment/            # Deployment scripts and config
│   ├── scripts/          # Deployment automation scripts
│   └── vps-config.json   # VPS configuration
├── src/                   # Source code
│   ├── commands/         # Slash commands
│   ├── config/           # Configuration management
│   ├── core/             # Core infrastructure
│   │   ├── cache/       # Redis caching
│   │   ├── database/    # PostgreSQL & repositories
│   │   ├── discord/     # Discord client
│   │   ├── logger/      # Logging system
│   │   ├── security/    # Security utilities
│   │   └── state/       # State persistence
│   ├── giveaway/         # Giveaway system
│   ├── managers/         # Business logic managers
│   ├── moderation/       # Moderation systems
│   │   └── rate-limiter/ # Channel text rate limiting
│   ├── services/         # External service integrations
│   │   ├── kick/        # Kick.com integration
│   │   ├── pusher/      # Pusher WebSocket client
│   │   └── google-safe-browsing/
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── property/         # Property-based tests
│   └── integration/      # Integration tests
├── docs/                  # Documentation
│   ├── QUICK_START.md
│   ├── DEPLOYMENT.md
│   ├── CICD_SETUP.md
│   ├── USER_GUIDE.md
│   ├── COMMAND_REFERENCE.md
│   ├── TROUBLESHOOTING.md
│   └── ...
└── logs/                  # Application logs
```

For detailed structure documentation, see [Project Structure](docs/project-structure.md).

## Documentation

### Getting Started
- [Quick Start Guide](docs/QUICK_START.md) - Get up and running in 15 minutes
- [Deployment Guide](docs/DEPLOYMENT.md) - Complete production deployment instructions
- [CI/CD Setup Guide](docs/CICD_SETUP.md) - Configure automated deployment pipeline
- [Database Setup](docs/DATABASE_SETUP.md) - Database configuration and migrations

### User Documentation
- [User Guide](docs/USER_GUIDE.md) - Complete guide for end users
- [Command Reference](docs/COMMAND_REFERENCE.md) - All available commands
- [Moderator Quick Reference](docs/MODERATOR_QUICK_REFERENCE.md) - Quick reference for moderators

### Technical Documentation
- [Project Structure](docs/project-structure.md) - Code organization and architecture
- [Pusher Implementation](docs/pusher-client-implementation.md) - Kick chat integration details
- [Log Retention Policy](docs/LOG_RETENTION_POLICY.md) - Log management and retention
- [VPS Monitoring](docs/VPS_MONITORING.md) - Runtime monitoring and alerting system
- [Monitoring Quick Reference](docs/MONITORING_QUICK_REFERENCE.md) - Quick monitoring commands
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md) - Common issues and solutions

### Specifications
- [Requirements](.kiro/specs/tzbot-discord-bot/requirements.md)
- [Design Document](.kiro/specs/tzbot-discord-bot/design.md)
- [Implementation Tasks](.kiro/specs/tzbot-discord-bot/tasks.md)

## Deployment

### Quick Deployment
For quick testing or development:
```bash
npm run build
npm start
```

### Production Deployment Options

#### Option 1: Manual VPS Deployment
See [Deployment Guide](docs/DEPLOYMENT.md) for:
- VPS setup with systemd
- PostgreSQL and Redis configuration
- HTTPS setup with Let's Encrypt
- Monitoring and logging
- Backup and disaster recovery

#### Option 2: CI/CD Auto-Deployment (Recommended)
Automated deployment pipeline with:
- Automatic testing on every push
- Auto-deployment to VPS on release
- Health checks and rollback
- Discord notifications

See [CI/CD Setup Guide](docs/CICD_SETUP.md) for configuration.

#### Option 3: Docker Deployment
```bash
docker-compose up -d
```

See [Deployment Guide](docs/DEPLOYMENT.md) for Docker configuration.

### Deployment Workflow
```
Development → CI Tests → release branch → Auto-Deploy → Health Check → Live
                                                ↓ (if fails)
                                            Rollback
```


## Testing

The project includes comprehensive test coverage:

### Test Types
- **Unit Tests**: Test individual components in isolation
- **Property-Based Tests**: Verify correctness properties across many inputs
- **Integration Tests**: Test component interactions

### Running Tests
```bash
# All tests
npm test

# Specific test suites
npm run test:unit
npm run test:property
npm run test:integration

# With coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Test Statistics
- 947+ unit tests
- 90+ property-based tests
- Comprehensive integration tests
- High code coverage

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Run linter (`npm run lint`)
6. Commit your changes (`git commit -m 'feat: add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Commit Convention
Follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

## Project Status

### Current Version
- **Version**: 1.0.0
- **Status**: Production Ready
- **Last Updated**: February 22, 2026

### Completed Features
- ✅ Discord bot with slash commands
- ✅ Kick.com integration with role sync
- ✅ Progressive spam punishment system
- ✅ Channel text rate limiting
- ✅ Interactive giveaway system
- ✅ Chat rain rewards
- ✅ Announcement relay system
- ✅ Link scanning with Google Safe Browsing
- ✅ CI/CD auto-deployment pipeline
- ✅ Comprehensive test suite
- ✅ Complete documentation

### Active Development
- Continuous improvements and bug fixes
- Performance optimizations
- Additional moderation features

## License

MIT License - see LICENSE file for details

## Support

### Getting Help
- **Documentation**: Check the [docs/](docs/) folder
- **Issues**: Open an issue on GitHub
- **Troubleshooting**: See [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### Reporting Issues
When reporting issues, include:
- Bot version
- Error messages and logs
- Steps to reproduce
- Expected vs actual behavior

### Community
- Discord Server: [Join our community](#)
- GitHub Discussions: [Ask questions](#)

---

**Built with ❤️ using TypeScript, Discord.js, and PostgreSQL**
