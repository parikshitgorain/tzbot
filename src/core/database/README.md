# Database Layer

PostgreSQL database layer with connection pooling, migrations, and version tracking.

## Features

- **Connection Pool**: Max 20 connections with automatic management
- **Migration System**: Version-tracked schema migrations with up/down scripts
- **Auto-Migration**: Runs migrations automatically on startup
- **Health Checks**: Test database connectivity
- **Transaction Support**: Full PostgreSQL transaction support

## Usage

### Initialize Database

```typescript
import { initializeDatabase } from './core/database';

await initializeDatabase({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'tzbot',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});
```

### Query Database

```typescript
import { getPool } from './core/database';

const pool = getPool();
const result = await pool.query('SELECT * FROM users WHERE discord_id = $1', [userId]);
```

### Using Transactions

```typescript
import { getPool } from './core/database';

const pool = getPool();
const client = await pool.connect();

try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users (discord_id) VALUES ($1)', [userId]);
  await client.query('INSERT INTO violations (user_id, type) VALUES ($1, $2)', [userId, 'spam']);
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

## Schema

### Tables

- **users**: Discord user records with optional Kick username links
- **violations**: Moderation violation tracking with timestamps
- **giveaways**: Giveaway state and configuration
- **giveaway_entries**: User entries for giveaways
- **chat_activity**: Chat activity tracking for chat rain
- **chat_rain_winners**: Chat rain reward distribution history
- **config**: Bot configuration key-value store
- **moderation_logs**: Audit log for moderation actions
- **message_content**: Temporary message storage (7-day retention)
- **notification_queue**: Failed notification retry queue
- **schema_migrations**: Migration version tracking

## Migrations

### Creating a New Migration

1. Create SQL files in `src/core/database/schema/`:
   - `00X_migration_name.sql` (up migration)
   - `00X_migration_name_down.sql` (down migration)

2. Add migration to `MIGRATIONS` array in `migrator.ts`:

```typescript
{
  version: 2,
  name: '002_add_new_table',
  upPath: join(__dirname, 'schema', '002_add_new_table.sql'),
  downPath: join(__dirname, 'schema', '002_add_new_table_down.sql'),
}
```

3. Migrations run automatically on next startup

### Manual Migration Control

```typescript
import { runMigrations, rollbackTo, getMigrationStatus } from './core/database';

// Check migration status
const status = await getMigrationStatus();
console.log(status);

// Run migrations manually
await runMigrations();

// Rollback to version 1
await rollbackTo(1);
```

## Environment Variables

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tzbot
DB_USER=postgres
DB_PASSWORD=your_password
DB_MAX_CONNECTIONS=20
```

## Connection Pool Configuration

The pool is configured with:
- **Max Connections**: 20 (per requirements)
- **Idle Timeout**: 30 seconds
- **Connection Timeout**: 5 seconds

Monitor pool health:

```typescript
import { getPoolStats } from './core/database';

const stats = getPoolStats();
console.log(stats);
// { totalCount: 5, idleCount: 3, waitingCount: 0 }
```

## Graceful Shutdown

```typescript
import { closePool } from './core/database';

// Close pool during shutdown
await closePool();
```

## Requirements Satisfied

- ✅ 2.5: User mapping persistence
- ✅ 3.5: Message deletion logging
- ✅ 4.1-4.6: Violation tracking and escalation
- ✅ 9.5: Giveaway entry recording
- ✅ 11.1: Chat activity tracking
