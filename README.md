# TZBOT Discord Bot

A comprehensive Discord moderation and engagement bot with Kick.com integration, featuring automated moderation, role synchronization, giveaways, and AI-powered auto-responses.

## Features

- **Live Notifications**: Real-time notifications from Kick.com with premium embeds
- **Automated Role Sync**: Automatic subscriber/VIP role assignment based on Kick status
- **Advanced Moderation**: Spam detection, link scanning, channel access enforcement
- **Slash Commands**: Fast-action moderation commands (/ban, /timeout, /warn, /kick)
- **Announcement Relay**: Private-to-public announcement system
- **Phishing Detection**: Advanced link scanning with zero-width character detection
- **Giveaway System**: Role-gated giveaways with CSPRNG winner selection
- **Chat Rain**: Algorithmic reward system for active chatters
- **AI Auto-Responder**: Optional AI-powered FAQ system (local LLM or cloud API)

## Requirements

- Node.js 18.0.0 or higher
- PostgreSQL 15+
- Redis 7+
- Discord Bot Token
- (Optional) Kick.com Developer Account
- (Optional) Google Safe Browsing API Key
- (Optional) OpenAI/Anthropic API Key for AI features

## Quick Start

For a quick setup guide, see [Quick Start Guide](docs/QUICK_START.md).

### Basic Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd tzbot-discord-bot
```

2. Install dependencies:
```bash
npm install
```

3. Copy the example environment file:
```bash
cp .env.example .env
```

4. Edit `.env` and fill in your configuration values

5. Build the project:
```bash
npm run build
```

6. Start the bot:
```bash
npm start
```

For production deployment with systemd, Docker, monitoring, and backups, see the [Deployment Guide](docs/DEPLOYMENT.md).

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Run linter:
```bash
npm run lint
```

Format code:
```bash
npm run format
```

## Configuration

All configuration is done through environment variables. See `.env.example` for all available options.

### Required Configuration

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_GUILD_ID`: Your Discord server ID
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `SUBSCRIBER_ROLE_ID`: Role ID for subscribers
- `VIP_ROLE_ID`: Role ID for VIPs
- `MODERATOR_ROLE_ID`: Role ID for moderators
- `NOTIFICATION_CHANNEL_ID`: Channel for notifications
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string

### Optional Configuration

- Kick.com integration settings
- Google Safe Browsing API key
- AI provider settings
- Chat rain configuration
- Custom spam thresholds

## Project Structure

```
tzbot/
├── src/                    # Source code
│   ├── config/            # Configuration management
│   ├── core/              # Core infrastructure
│   ├── managers/          # Business logic managers
│   ├── commands/          # Slash commands
│   ├── services/          # External service integrations
│   ├── systems/           # Complex subsystems
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   ├── property/         # Property-based tests
│   └── integration/      # Integration tests
├── docs/                  # Documentation
└── scripts/              # Utility scripts
```

## Documentation

### Getting Started
- [Quick Start Guide](docs/QUICK_START.md) - Get up and running in 15 minutes
- [Deployment Guide](docs/DEPLOYMENT.md) - Complete production deployment instructions

### Technical Documentation
- [Project Structure](docs/project-structure.md)
- [Pusher Client Implementation](docs/pusher-client-implementation.md)

### Specifications
- [Requirements](.kiro/specs/tzbot-discord-bot/requirements.md)
- [Design Document](.kiro/specs/tzbot-discord-bot/design.md)
- [Implementation Tasks](.kiro/specs/tzbot-discord-bot/tasks.md)

## License

MIT

## Support

For issues and questions, please open an issue on GitHub.
