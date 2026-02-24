# Database Usage & Optimization Guide

This document explains when the bot uses the database and how caching is implemented to minimize compute usage.

## Database Overview

- **Provider**: Neon PostgreSQL (Serverless)
- **Limit**: 100 compute hours per month
- **Optimization Strategy**: Redis caching + batch writes

---

## Database Usage by Feature

### 1. Giveaway System

#### When Database is Used:
- **Giveaway Creation** (1 write)
  - Stores giveaway metadata (title, description, end time, etc.)
  - No caching needed - happens once per giveaway

- **User Entry** (2 operations per entry)
  - Check if user already entered (1 read) - uses `hasEntry()`
  - Add entry to database (1 write)
  - **OPTIMIZED**: Entry count cached in Redis, no need to query all entries

- **Entry Count Display** (cached)
  - **Before**: Queried database on every entry to count all entries
  - **After**: Uses Redis cache, increments counter
  - **Cache TTL**: 1 hour
  - **Savings**: ~99% reduction in queries for active giveaways

- **Giveaway End** (2-3 operations)
  - Fetch giveaway details (1 read)
  - Fetch all entries (1 read)
  - Update winners (1 write)
  - Update status to ENDED (1 write)

- **Reroll Winner** (3 operations)
  - Fetch giveaway (1 read)
  - Fetch entries (1 read)
  - Update winners (1 write)

#### Caching Strategy:
```typescript
// Entry count cached per giveaway
Key: `giveaway:entries:{giveawayId}`
TTL: 1 hour
Invalidation: When giveaway ends
```

---

### 2. Permission System

#### When Database is Used:
- **Permission Check** (1 read per command)
  - Checks if user/role can use giveaway commands
  - **OPTIMIZED**: Results cached in Redis

- **Permission Update** (1 write)
  - When admin adds/removes roles or users
  - Cache invalidated immediately

#### Caching Strategy:
```typescript
// Permission config cached per guild
Key: `giveaway:permissions:{guildId}`
TTL: 5 minutes
Invalidation: On permission update
Savings: ~95% reduction for frequent command usage
```

**Example**: If 10 users run giveaway commands per minute:
- **Without cache**: 600 DB queries/hour
- **With cache**: ~12 DB queries/hour (one per 5 minutes)

---

### 3. Moderation System

#### When Database is Used:
- **Offense Recording** (2-3 operations per offense)
  - Fetch user's offense record (1 read)
  - Update offense count (1 write)
  - Record violation details (1 write)
  - **No caching**: Offense data must be accurate for punishment calculation

- **Offense History** (1 read)
  - When moderator checks user's history
  - Infrequent operation, no caching needed

#### Why No Caching:
- Critical for accurate punishment escalation
- Infrequent compared to message volume (only spam/violations)
- Must be consistent across bot restarts

---

### 4. Chat Activity (Chat Rain) - FUTURE FEATURE

#### When Database is Used:
- **Activity Recording** (batched writes)
  - Records user messages for chat rain eligibility
  - **OPTIMIZED**: Batch writes every 50 messages OR 30 seconds

- **Active Chatter Query** (1 read per chat rain event)
  - Finds users who sent 3+ messages in time window
  - **OPTIMIZED**: Results cached for 5 minutes

#### Caching & Batching Strategy:
```typescript
// Message count cached per user
Key: `chat:count:{userId}`
TTL: 1 hour
Update: Incremented immediately in Redis

// Batch queue
Size: 50 messages
Timeout: 30 seconds
Flush: Whichever comes first
```

**Example**: 100 messages per minute:
- **Without batching**: 6,000 DB writes/hour
- **With batching**: ~120 DB writes/hour (50 messages per batch)
- **Savings**: 98% reduction in database writes

#### Shutdown Handling:
- Pending batch automatically flushed on graceful shutdown
- No data loss

---

## Current Database Load Estimate

### Active Features (Per Hour):

| Feature | Operations | Frequency | DB Queries/Hour |
|---------|-----------|-----------|-----------------|
| Giveaway Permissions | Read | Per command | ~12 (cached) |
| Giveaway Entry | Write | Per entry | ~2 per entry |
| Giveaway End | Read/Write | Per giveaway | ~4 per giveaway |
| Spam Detection | Read/Write | Per violation | ~3 per violation |
| Offense Tracking | Read/Write | Per offense | ~3 per offense |

### Inactive Features:
- Chat Rain: Currently disabled in config
- User Linking: No active usage
- Reward System: Currently disabled

---

## Optimization Summary

### What We Cache:
1. ✅ **Giveaway entry counts** - Redis cache, 1 hour TTL
2. ✅ **Permission configs** - Redis cache, 5 minutes TTL
3. ✅ **Chat activity counts** - Redis cache, 1 hour TTL (future)
4. ✅ **Active chatter lists** - Redis cache, 5 minutes TTL (future)

### What We Batch:
1. ✅ **Chat activity writes** - 50 messages or 30 seconds (future)

### What We Don't Cache:
1. ❌ **Offense records** - Must be accurate for punishment
2. ❌ **Violation history** - Critical moderation data
3. ❌ **Giveaway creation** - One-time operation
4. ❌ **Winner selection** - Critical operation, must be accurate

---

## Redis vs Database Decision Matrix

| Data Type | Use Redis | Use Database | Reason |
|-----------|-----------|--------------|---------|
| Entry counts | ✅ Cache | ✅ Source | Frequently read, can tolerate slight delay |
| Permissions | ✅ Cache | ✅ Source | Frequently checked, rarely changed |
| Offenses | ❌ | ✅ Only | Critical for punishment accuracy |
| Giveaway data | ❌ | ✅ Only | Must persist, not frequently accessed |
| Chat activity | ✅ Buffer | ✅ Source | High volume, batch writes |
| Active chatters | ✅ Cache | ✅ Source | Expensive query, can cache result |

---

## Monitoring Database Usage

### Check Current Usage:
1. Log into Neon Console: https://console.neon.tech
2. Navigate to your project
3. Check "Usage" tab for compute hours

### Expected Usage (Per Month):
- **Low Activity** (10 users): ~5-10 compute hours
- **Medium Activity** (50 users): ~20-30 compute hours
- **High Activity** (200 users): ~50-70 compute hours

### If Approaching Limit:
1. Check if chat rain is enabled (highest DB usage)
2. Increase cache TTL for permissions (currently 5 min)
3. Increase batch size for chat activity (currently 50)
4. Consider upgrading Neon plan

---

## Cache Invalidation Strategy

### Automatic Invalidation:
- **Permission updates**: Immediate cache clear
- **Giveaway end**: Entry count cache cleared
- **TTL expiry**: Automatic after configured time

### Manual Invalidation (if needed):
```bash
# Clear all giveaway caches
redis-cli KEYS "giveaway:*" | xargs redis-cli DEL

# Clear specific guild permissions
redis-cli DEL "giveaway:permissions:{guildId}"

# Clear all chat activity caches
redis-cli KEYS "chat:*" | xargs redis-cli DEL
```

---

## Best Practices

### For Developers:
1. ✅ Always check cache before database
2. ✅ Set appropriate TTL based on data freshness needs
3. ✅ Invalidate cache on data updates
4. ✅ Use batch writes for high-volume operations
5. ✅ Log cache hits/misses for monitoring

### For Administrators:
1. ✅ Monitor database usage monthly
2. ✅ Keep chat rain disabled unless needed
3. ✅ Use Redis for session data, not database
4. ✅ Run database cleanup periodically (old chat activity)

---

## Future Optimizations

### Potential Improvements:
1. **Read replicas**: Use Neon read replicas for queries
2. **Connection pooling**: Already implemented (max 20 connections)
3. **Query optimization**: Add indexes for frequent queries
4. **Materialized views**: For complex aggregations
5. **Edge caching**: Cache static data at CDN level

### Not Recommended:
- ❌ Caching offense data (accuracy critical)
- ❌ Caching giveaway winners (must be authoritative)
- ❌ Reducing batch timeout below 30s (too many writes)

---

## Troubleshooting

### High Database Usage:
1. Check if chat rain is enabled
2. Review logs for excessive permission checks
3. Verify Redis is connected and working
4. Check for batch write failures (re-queuing)

### Cache Issues:
1. Verify Redis connection: `redis-cli PING`
2. Check Redis memory: `redis-cli INFO memory`
3. Review cache hit rate in logs
4. Ensure cache TTL is appropriate

### Data Inconsistency:
1. Clear affected cache keys
2. Verify database connection
3. Check for failed writes in logs
4. Restart bot to reload fresh data

---

## Summary

With the implemented caching and batching optimizations:

- **Giveaway entry counts**: 99% reduction in queries
- **Permission checks**: 95% reduction in queries  
- **Chat activity** (when enabled): 98% reduction in writes
- **Overall**: Should stay well under 100 compute hours/month

The bot is now optimized for minimal database usage while maintaining data accuracy where it matters most.
