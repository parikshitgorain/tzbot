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
2. **violations** - User violation tracking for moderation
3. **giveaways** - Giveaway management
4. **giveaway_entries** - User entries for giveaways
5. **chat_activity** - Chat activity tracking for chat rain
6. **chat_rain_winners** - Winners of chat rain events
7. **config** - Bot configuration storage
8. **moderation_logs** - Moderation action logs
9. **message_content** - Message content (7-day retention)
10. **notification_queue** - Notification retry queue
11. **schema_migrations** - Migration tracking

### Running Migrations

To run database migrations:

```bash
npm run db:migrate
```

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
DATABASE_URL=postgresql://neondb_owner:npg_sjStPEF6Cr3L@ep-blue-hill-aenvo7td.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require
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

