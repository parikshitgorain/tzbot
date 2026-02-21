# TZBOT Project Structure Blueprint

This document defines the official folder structure and organization for the TZBOT Discord bot project.

## Directory Structure

```
tzbot/
├── .kiro/                          # Kiro specs (already exists)
│   └── specs/
│       └── tzbot-discord-bot/
├── src/                            # Source code
│   ├── index.ts                    # Application entry point
│   ├── bot.ts                      # Main bot initialization
│   │
│   ├── config/                     # Configuration management
│   │   ├── index.ts
│   │   ├── validator.ts
│   │   └── types.ts
│   │
│   ├── core/                       # Core infrastructure
│   │   ├── discord/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── database/
│   │   │   ├── connection.ts
│   │   │   ├── migrations/
│   │   │   └── repositories/
│   │   │       ├── user.repository.ts
│   │   │       ├── violation.repository.ts
│   │   │       ├── giveaway.repository.ts
│   │   │       ├── chat-activity.repository.ts
│   │   │       └── config.repository.ts
│   │   ├── cache/
│   │   │   └── redis.client.ts
│   │   └── logger/
│   │       └── logger.ts
│   │
│   ├── managers/                   # Business logic managers
│   │   ├── event.manager.ts
│   │   ├── command.manager.ts
│   │   ├── moderation.manager.ts
│   │   ├── notification.manager.ts
│   │   ├── giveaway.manager.ts
│   │   ├── chat-rain.manager.ts
│   │   └── ai-responder.manager.ts
│   │
│   ├── commands/                   # Slash commands
│   │   ├── moderation/
│   │   │   ├── ban.command.ts
│   │   │   ├── kick.command.ts
│   │   │   ├── timeout.command.ts
│   │   │   └── warn.command.ts
│   │   ├── utility/
│   │   │   ├── config.command.ts
│   │   │   ├── link.command.ts
│   │   │   ├── unlink.command.ts
│   │   │   ├── checklink.command.ts
│   │   │   └── deletemydata.command.ts
│   │   └── types.ts
│   │
│   ├── services/                   # External service integrations
│   │   ├── kick/
│   │   │   ├── api.client.ts
│   │   │   ├── chat.client.ts
│   │   │   ├── oauth.service.ts
│   │   │   └── types.ts
│   │   ├── google-safe-browsing/
│   │   │   └── client.ts
│   │   ├── pusher/
│   │   │   └── client.ts
│   │   └── llm/
│   │       ├── ollama.client.ts
│   │       └── openai.client.ts
│   │
│   ├── systems/                    # Complex subsystems
│   │   ├── moderation/
│   │   │   ├── spam-detector.ts
│   │   │   ├── link-scanner.ts
│   │   │   ├── channel-enforcer.ts
│   │   │   ├── violation-tracker.ts
│   │   │   └── types.ts
│   │   ├── notification/
│   │   │   ├── embed-formatter.ts
│   │   │   ├── webhook-receiver.ts
│   │   │   ├── polling-fallback.ts
│   │   │   └── types.ts
│   │   ├── giveaway/
│   │   │   ├── entry-validator.ts
│   │   │   ├── winner-selector.ts
│   │   │   └── types.ts
│   │   └── security/
│   │       ├── encryption.ts
│   │       ├── rate-limiter.ts
│   │       └── csprng.service.ts
│   │
│   ├── utils/                      # Utility functions
│   │   ├── url-normalizer.ts
│   │   ├── time.utils.ts
│   │   ├── validation.utils.ts
│   │   └── retry.utils.ts
│   │
│   ├── types/                      # Shared TypeScript types
│   │   ├── models.ts
│   │   ├── enums.ts
│   │   └── interfaces.ts
│   │
│   └── middleware/                 # Express middleware
│       ├── auth.middleware.ts
│       ├── validation.middleware.ts
│       └── logging.middleware.ts
│
├── tests/                          # Test files
│   ├── unit/
│   │   ├── moderation/
│   │   ├── notifications/
│   │   ├── giveaways/
│   │   └── chat-rain/
│   ├── property/                   # Property-based tests
│   │   ├── moderation.property.test.ts
│   │   ├── notifications.property.test.ts
│   │   ├── giveaways.property.test.ts
│   │   ├── chat-rain.property.test.ts
│   │   ├── csprng.property.test.ts
│   │   └── security.property.test.ts
│   ├── integration/
│   │   ├── discord-client.test.ts
│   │   ├── kick-api.test.ts
│   │   └── end-to-end.test.ts
│   └── helpers/
│       └── test-utils.ts
│
├── docs/                           # Documentation
│   ├── deployment.md
│   ├── user-guide.md
│   ├── api-reference.md
│   └── troubleshooting.md
│
├── scripts/                        # Utility scripts
│   ├── setup-db.sh
│   ├── backup.sh
│   └── deploy.sh
│
├── .env.example                    # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
└── README.md
```

## Design Principles

### 1. Separation of Concerns
Each folder has a clear, single responsibility:
- **config/**: Configuration loading and validation
- **core/**: Infrastructure components (database, cache, Discord client)
- **managers/**: High-level business logic orchestration
- **commands/**: Discord slash command implementations
- **services/**: External API integrations
- **systems/**: Complex subsystems with multiple components
- **utils/**: Pure utility functions
- **types/**: Shared TypeScript type definitions

### 2. Scalability
The structure allows easy addition of new features:
- New commands go in `commands/`
- New external services go in `services/`
- New business logic goes in `managers/`
- New subsystems go in `systems/`

### 3. Testability
Test structure mirrors source structure:
- Unit tests in `tests/unit/` match `src/` structure
- Property-based tests in `tests/property/`
- Integration tests in `tests/integration/`

### 4. Maintainability
Related code is grouped together:
- All moderation logic in `systems/moderation/`
- All Kick integration in `services/kick/`
- All database repositories in `core/database/repositories/`

### 5. Type Safety
Centralized type definitions in `types/`:
- `models.ts`: Data models (User, Violation, Giveaway, etc.)
- `enums.ts`: Enumerations (ViolationType, PunishmentLevel, etc.)
- `interfaces.ts`: Shared interfaces

## Folder Descriptions

### `/src/config/`
Configuration management system:
- Load environment variables
- Validate configuration
- Provide typed configuration objects
- Support hot-reload

### `/src/core/`
Core infrastructure components:
- **discord/**: Discord.js client wrapper
- **database/**: PostgreSQL connection, migrations, repositories
- **cache/**: Redis client for caching and rate limiting
- **logger/**: Structured logging system

### `/src/managers/`
High-level business logic orchestrators:
- **event.manager.ts**: Routes Discord events to appropriate handlers
- **command.manager.ts**: Registers and handles slash commands
- **moderation.manager.ts**: Orchestrates moderation actions
- **notification.manager.ts**: Manages Kick notifications
- **giveaway.manager.ts**: Manages giveaway lifecycle
- **chat-rain.manager.ts**: Manages chat rain events
- **ai-responder.manager.ts**: Manages AI auto-responses

### `/src/commands/`
Discord slash command implementations:
- **moderation/**: Ban, kick, timeout, warn commands
- **utility/**: Config, link, unlink, checklink, deletemydata commands

### `/src/services/`
External service integrations:
- **kick/**: Kick.com API client, chat client, OAuth
- **google-safe-browsing/**: Google Safe Browsing API client
- **pusher/**: Pusher WebSocket client
- **llm/**: LLM integrations (Ollama, OpenAI)

### `/src/systems/`
Complex subsystems with multiple components:
- **moderation/**: Spam detection, link scanning, channel enforcement
- **notification/**: Embed formatting, webhook receiver, polling fallback
- **giveaway/**: Entry validation, winner selection
- **security/**: Encryption, rate limiting, CSPRNG

### `/src/utils/`
Pure utility functions:
- URL normalization
- Time utilities
- Validation utilities
- Retry utilities with exponential backoff

### `/src/types/`
Shared TypeScript type definitions:
- Data models
- Enumerations
- Interfaces

### `/src/middleware/`
Express middleware for webhook server:
- Authentication
- Request validation
- Logging

### `/tests/`
Comprehensive test suite:
- **unit/**: Unit tests for individual components
- **property/**: Property-based tests for correctness properties
- **integration/**: Integration tests for end-to-end flows
- **helpers/**: Test utilities and mocks

### `/docs/`
Project documentation:
- Deployment guide
- User guide
- API reference
- Troubleshooting guide

### `/scripts/`
Utility scripts:
- Database setup
- Backup scripts
- Deployment scripts

## Naming Conventions

### Files
- TypeScript files: `kebab-case.ts`
- Test files: `kebab-case.test.ts`
- Property test files: `kebab-case.property.test.ts`
- Type definition files: `kebab-case.ts`

### Classes
- PascalCase: `EventManager`, `SpamDetector`, `UserRepository`

### Interfaces
- PascalCase with descriptive names: `DiscordClient`, `KickAPIClient`, `Database`

### Functions
- camelCase: `normalizeUrl()`, `checkSpam()`, `sendNotification()`

### Constants
- UPPER_SNAKE_CASE: `MAX_RETRIES`, `DEFAULT_TIMEOUT`

### Enums
- PascalCase for enum name, UPPER_CASE for values:
  ```typescript
  enum ViolationType {
    SPAM = 'spam',
    MALICIOUS_LINK = 'malicious_link'
  }
  ```

## Import Organization

Imports should be organized in the following order:
1. External dependencies (discord.js, pg, redis, etc.)
2. Internal core modules (config, database, logger)
3. Internal managers
4. Internal services
5. Internal systems
6. Internal utils
7. Internal types

Example:
```typescript
// External
import { Client, GatewayIntentBits } from 'discord.js';
import { Pool } from 'pg';

// Core
import { config } from '@/config';
import { logger } from '@/core/logger';

// Managers
import { EventManager } from '@/managers/event.manager';

// Services
import { KickAPIClient } from '@/services/kick/api.client';

// Systems
import { SpamDetector } from '@/systems/moderation/spam-detector';

// Utils
import { normalizeUrl } from '@/utils/url-normalizer';

// Types
import { User, Violation } from '@/types/models';
```

## Path Aliases

Configure TypeScript path aliases in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@config/*": ["./src/config/*"],
      "@core/*": ["./src/core/*"],
      "@managers/*": ["./src/managers/*"],
      "@commands/*": ["./src/commands/*"],
      "@services/*": ["./src/services/*"],
      "@systems/*": ["./src/systems/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"]
    }
  }
}
```

## Module Exports

Each folder should have an `index.ts` that exports public APIs:
```typescript
// src/systems/moderation/index.ts
export { SpamDetector } from './spam-detector';
export { LinkScanner } from './link-scanner';
export { ChannelEnforcer } from './channel-enforcer';
export { ViolationTracker } from './violation-tracker';
export * from './types';
```

This allows clean imports:
```typescript
import { SpamDetector, LinkScanner } from '@/systems/moderation';
```

## Documentation Standards

### File Headers
Every file should have a header comment:
```typescript
/**
 * @file spam-detector.ts
 * @description Detects spam messages based on frequency and content
 * @module systems/moderation
 */
```

### Function Documentation
Use JSDoc for all public functions:
```typescript
/**
 * Checks if a message is spam based on configured thresholds
 * @param message - The Discord message to check
 * @param userId - The ID of the user who sent the message
 * @returns SpamResult indicating if spam was detected
 */
export async function checkSpam(message: Message, userId: string): Promise<SpamResult> {
  // Implementation
}
```

### Class Documentation
Use JSDoc for all classes:
```typescript
/**
 * Manages spam detection and tracking for users
 * @class SpamDetector
 */
export class SpamDetector {
  // Implementation
}
```

## Best Practices

1. **Single Responsibility**: Each file should have one clear purpose
2. **Dependency Injection**: Pass dependencies through constructors
3. **Interface Segregation**: Define small, focused interfaces
4. **Error Handling**: Use try-catch and proper error types
5. **Logging**: Log all significant events with context
6. **Testing**: Write tests alongside implementation
7. **Type Safety**: Avoid `any`, use proper types
8. **Immutability**: Prefer `const` and readonly properties
9. **Async/Await**: Use async/await over promises
10. **Code Comments**: Comment complex logic, not obvious code

## Version Control

### .gitignore
```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
coverage/
.vscode/
.idea/
```

### Commit Messages
Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

Example: `feat: implement spam detection system`

## Maintenance

This structure should be reviewed and updated as the project evolves. Major structural changes should be documented here with rationale and migration guide.

---

**Last Updated**: 2026-02-20
**Version**: 1.0.0
**Maintainer**: TZBOT Development Team
