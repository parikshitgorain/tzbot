# Database Setup Guide

## Neon Postgres Database

Your Discord bot is now connected to a Neon Postgres database.

### Database Information

- **Project Name**: tzbot-discord-bot
- **Project ID**: ancient-river-25395679
- **Region**: AWS US East 2 (Ohio)
- **Connection String**: Stored in `.env` file

### Database Schema

The following tables have been created:

1. **users** - Discord user profiles with Kick username linking
2. **violations** - User violation tracking for moderation (legacy)
3. **offense_records** - Progressive spam punishment offense tracking
4. **offense_entries** - Individual offense records with timestamps
5. **giveaways** - Giveaway management
6. **giveaway_entries** - User entries for giveaways
7. **chat_activity** - Chat activity tracking for chat rain
8. **chat_rain_winners** - Winners of chat rain events
9. **config** - Bot configuration storage
10. **moderation_logs** - Moderation action logs
11. **message_content** - Message content (7-day retention)
12. **notification_queue** - Notification retry queue
13. **schema_migrations** - Migration tracking

### Running Migrations

To run database migrations:

```bash
npm run db:migrate
```

### Migration History

- **001_initial_schema.sql** - Initial database schema with users, violations, giveaways, etc.
- **002_offense_tracking.sql** - Progressive spam punishment system (offense_records, offense_entries)

### Accessing the Database

You can access your Neon database through:

1. **Neon Console**: https://console.neon.tech
2. **VS Code Extension**: Use the Neon Local Connect extension
3. **CLI**: Use `npx neonctl` commands

### Common Commands

```bash
# List all projects
npx neonctl projects list

# Get connection string
npx neonctl connection-string

# View database info
npx neonctl databases list

# Create a new branch (for testing)
npx neonctl branches create --name dev
```

### Environment Variables

Make sure your `.env` file contains:

```env
DATABASE_URL=postgresql://your_db_user:your_db_password@your_db_host/your_db_name?sslmode=require
DATABASE_MAX_CONNECTIONS=20
```

### Redis Setup (Optional)

Redis is optional for caching. The bot will run without it but with reduced performance for rate limiting and caching features.

#### Option 1: Run with Admin PowerShell
```powershell
# Open PowerShell as Administrator
choco install memurai-developer -y
```

#### Option 2: Skip Redis
The bot will automatically handle Redis connection failures and run without caching. You'll see warnings in the logs but the bot will function normally.

### Next Steps

1. ✅ Database created
2. ✅ Schema migrated
3. ✅ Redis made optional
4. ⏳ Configure Discord bot tokens in `.env`
5. ⏳ Configure Kick.com API keys in `.env`
6. ⏳ Run the bot with `npm run dev`

### Troubleshooting

If you encounter connection issues:

1. Check that your `.env` file has the correct `DATABASE_URL`
2. Verify your Neon project is active in the console
3. Ensure your IP is not blocked (Neon allows all IPs by default)
4. Check the connection string includes `?sslmode=require`

### Security Notes

- The database password is stored in `.env` - never commit this file
- Neon automatically handles SSL/TLS encryption
- Connection pooling is configured with max 20 connections
- All sensitive data should be encrypted before storage

