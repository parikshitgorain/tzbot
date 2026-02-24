# Cache Write Strategy Guide

This document explains when to use different caching strategies for write operations.

---

## Write Strategies Overview

### 1. Write-Through (Database First) ✅ RECOMMENDED FOR CRITICAL DATA
```
User Action → Database Write → Cache Update → Response
```

**Use for:**
- Permissions (security-critical)
- Giveaway creation (must persist)
- Offense records (accuracy-critical)
- Winner selection (must be authoritative)

**Advantages:**
- Data durability guaranteed
- Database is always source of truth
- No data loss on cache failure
- Consistent across bot restarts

**Disadvantages:**
- Slightly slower (waits for DB write)
- Two operations per write

**Example:**
```typescript
// Permission update - Write-Through
async updateGiveawayPermissions(guildId, roles, users) {
  // 1. Write to database FIRST
  await this.configRepository.updateGiveawayPermissions(guildId, roles, users);
  
  // 2. Update cache immediately
  await redisClient.set(cacheKey, JSON.stringify(config), TTL);
  
  // 3. Return success
  return;
}
```

---

### 2. Write-Behind (Cache First) ⚠️ USE WITH CAUTION
```
User Action → Cache Write → Response → Database Write (async)
```

**Use for:**
- High-volume, non-critical data
- Chat activity tracking
- Analytics/metrics
- Temporary session data

**Advantages:**
- Very fast response
- Reduces database load
- Can batch multiple writes

**Disadvantages:**
- Risk of data loss on crash
- Cache and DB can be out of sync
- Requires flush on shutdown

**Example:**
```typescript
// Chat activity - Write-Behind with batching
async record(userId, timestamp) {
  // 1. Update cache immediately
  await redisClient.incr(`chat:count:${userId}`);
  
  // 2. Add to batch queue
  this.batchQueue.push({ userId, timestamp });
  
  // 3. Return immediately (fast!)
  return;
  
  // 4. Flush to database later (async)
  // - After 50 messages OR
  // - After 30 seconds OR
  // - On shutdown
}
```

---

### 3. Write-Around (Database Only, No Cache)
```
User Action → Database Write → Cache Invalidate → Response
```

**Use for:**
- Infrequent writes
- Data that's rarely read after write
- When cache would be stale immediately

**Advantages:**
- Simple implementation
- No cache consistency issues
- Good for write-heavy, read-light data

**Disadvantages:**
- Next read will be slow (cache miss)
- Wasted cache space if not read

**Example:**
```typescript
// Violation record - Write-Around
async saveViolation(violation) {
  // 1. Write to database
  await this.violationRepo.save(violation);
  
  // 2. Don't cache (rarely read)
  // Next read will fetch from DB
  
  return;
}
```

---

## Decision Matrix

| Data Type | Strategy | Reason | Risk Level |
|-----------|----------|--------|------------|
| **Permissions** | Write-Through | Security-critical, must persist | 🔴 High |
| **Giveaway Data** | Write-Through | Must be authoritative | 🔴 High |
| **Offense Records** | Write-Through | Punishment accuracy critical | 🔴 High |
| **Winner Selection** | Write-Through | Must be permanent | 🔴 High |
| **Entry Counts** | Write-Through + Cache | Frequently read, must be accurate | 🟡 Medium |
| **Chat Activity** | Write-Behind (Batch) | High volume, can tolerate loss | 🟢 Low |
| **Session Data** | Cache Only | Temporary, OK to lose | 🟢 Low |
| **Violations** | Write-Around | Rarely read after write | 🟢 Low |

---

## Current Implementation

### Write-Through (Database First):
```typescript
// ✅ Permissions
await db.updatePermissions(guildId, roles, users);
await cache.set(key, data, TTL);

// ✅ Giveaway Creation
await db.saveGiveaway(giveaway);
// No cache (one-time operation)

// ✅ Offense Recording
await db.recordOffense(userId, offense);
// No cache (accuracy critical)

// ✅ Winner Selection
await db.updateWinners(giveawayId, winners);
// No cache (must be authoritative)
```

### Write-Behind (Cache First):
```typescript
// ✅ Chat Activity (batched)
await cache.incr(`chat:count:${userId}`);
batchQueue.push({ userId, timestamp });
// Flush to DB every 50 messages or 30 seconds

// ✅ Entry Count (incremental)
await cache.incr(`giveaway:entries:${giveawayId}`);
await db.addEntry(giveawayId, userId);
// Cache updated immediately, DB write happens
```

---

## Why NOT Cache-First for Permissions?

### ❌ Bad Approach (Cache-First):
```typescript
// DON'T DO THIS!
async updatePermissions(guildId, roles, users) {
  // 1. Update cache first
  await cache.set(key, data);
  
  // 2. Update database later
  await db.update(guildId, roles, users);
  
  // ⚠️ PROBLEM: If bot crashes between steps 1 and 2,
  // permissions are lost! Security risk!
}
```

### ✅ Good Approach (Database-First):
```typescript
// DO THIS!
async updatePermissions(guildId, roles, users) {
  // 1. Update database FIRST (source of truth)
  await db.update(guildId, roles, users);
  
  // 2. Update cache for instant effect
  await cache.set(key, data);
  
  // ✅ If bot crashes after step 1, data is safe in DB
  // ✅ If cache fails, next read will fetch from DB
}
```

---

## Handling Cache Failures

### On Cache Write Failure:
```typescript
try {
  await cache.set(key, data, TTL);
} catch (cacheError) {
  // Log warning but don't fail the operation
  logger.warn('Cache update failed', { error: cacheError });
  // Database is already updated, so operation succeeded
}
```

### On Cache Read Failure:
```typescript
try {
  const cached = await cache.get(key);
  if (cached) return JSON.parse(cached);
} catch (cacheError) {
  logger.warn('Cache read failed, falling back to database');
}

// Always fallback to database
return await db.get(key);
```

---

## Batch Write Strategy (Chat Activity)

### How It Works:
```typescript
class ChatActivityRepository {
  private batchQueue = [];
  private batchTimer = null;
  private BATCH_SIZE = 50;
  private BATCH_TIMEOUT_MS = 30000;

  async record(userId, timestamp) {
    // 1. Update cache immediately (fast!)
    await cache.incr(`chat:count:${userId}`);
    
    // 2. Add to batch queue
    this.batchQueue.push({ userId, timestamp });
    
    // 3. Flush if batch is full
    if (this.batchQueue.length >= this.BATCH_SIZE) {
      await this.flushBatch();
    }
    
    // 4. Or flush after timeout
    else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.BATCH_TIMEOUT_MS);
    }
  }

  async flushBatch() {
    // Batch insert to database
    const values = batch.map((_, i) => `($${i*2+1}, $${i*2+2})`).join(', ');
    await db.query(`INSERT INTO chat_activity VALUES ${values}`, params);
  }
}
```

### Shutdown Handling:
```typescript
// In Database.disconnect()
async disconnect() {
  // Flush any pending writes before closing
  if (this.chatActivityRepo) {
    await this.chatActivityRepo.forceFlush();
  }
  
  await closePool();
}
```

---

## Performance Comparison

### Permission Update (Write-Through):
```
Without Cache:
User → DB Write (50ms) → Response
Total: 50ms

With Cache (Database-First):
User → DB Write (50ms) → Cache Update (5ms) → Response
Total: 55ms (+5ms, but next 100 reads are instant)

With Cache (Cache-First) ❌ RISKY:
User → Cache Update (5ms) → Response → DB Write (50ms async)
Total: 5ms (but data loss risk!)
```

### Chat Activity (Write-Behind):
```
Without Batching:
100 messages → 100 DB writes (5000ms)
Total: 5000ms

With Batching:
100 messages → 100 cache updates (500ms) → 2 DB writes (100ms)
Total: 600ms (88% faster!)
```

---

## Best Practices

### ✅ DO:
1. Use Write-Through for critical data (permissions, giveaways, offenses)
2. Use Write-Behind for high-volume, non-critical data (chat activity)
3. Always write to database first for security-critical operations
4. Update cache immediately after DB write for instant effect
5. Flush batches on graceful shutdown
6. Log cache failures but don't fail operations
7. Always have database fallback on cache miss

### ❌ DON'T:
1. Use cache-first for permissions or security data
2. Rely on cache as source of truth
3. Batch critical data (permissions, winners)
4. Ignore cache failures silently
5. Skip database writes to "save time"
6. Cache data that's never read again
7. Use infinite cache TTL for changing data

---

## Monitoring

### Key Metrics to Track:
```typescript
// Cache hit rate
const hitRate = cacheHits / (cacheHits + cacheMisses);
// Target: > 90%

// Batch flush frequency
const flushesPerHour = totalFlushes / hours;
// Target: < 120 (every 30 seconds)

// Cache write failures
const cacheFailureRate = cacheErrors / totalWrites;
// Target: < 1%

// Database write latency
const avgWriteTime = totalWriteTime / totalWrites;
// Target: < 100ms
```

---

## Summary

**For your question: "when we give someone permission then cache it first then do later push database this way?"**

**Answer: NO! ❌**

For permissions (and all critical data), we should:
1. ✅ Write to database FIRST (source of truth)
2. ✅ Update cache immediately (for instant effect)
3. ✅ Return success to user

This ensures:
- Data is never lost (database is durable)
- Changes take effect immediately (cache is updated)
- System is consistent (database is always correct)
- No security risks (permissions are permanent)

Cache-first is ONLY for non-critical, high-volume data like chat activity tracking where we can tolerate some data loss.
