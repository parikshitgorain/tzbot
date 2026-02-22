# Duplicate Message Fix - Announcement Relay

## Issue: Messages Sent 2-3 Times

### Problem Description
When using the announcement relay system, messages from the private channel were being sent 2-3 times to public channels.

### Root Cause

The issue was caused by **multiple event listener registrations**:

1. **Initial Instance**: `AnnouncementRelayManager` created on bot startup (in `index.ts`)
2. **Command Instance**: New instance created when `/announcement-setup` is run
3. **No Cleanup**: Old event listeners were not removed
4. **Result**: Multiple instances listening to the same events → duplicate messages

### Technical Details

**Before Fix:**
```typescript
// In announcement-relay.manager.ts
start(): void {
  if (this.isListening) {
    return; // ⚠️ Prevents duplicate registration but doesn't remove old listeners
  }
  
  // ❌ Anonymous function - can't be removed later
  this.discordClient.on('messageCreate', async (message: Message) => {
    await this.handleMessage(message);
  });
  
  this.isListening = true;
}

stop(): void {
  // ❌ Can't remove listener - no reference to the function
  this.isListening = false;
}
```

**Problem Flow:**
```
1. Bot starts → Instance A created → Listener A registered
2. User runs /announcement-setup → Instance B created → Listener B registered
3. Message sent → Both Listener A and B fire → Message sent twice
4. User runs /announcement-setup again → Instance C created → Listener C registered
5. Message sent → Listeners A, B, and C fire → Message sent 3 times
```

### Solution

**1. Store Bound Handler Reference**
```typescript
private boundMessageHandler?: (message: Message) => Promise<void>;

start(): void {
  if (this.isListening) {
    return;
  }
  
  // ✅ Store reference to bound handler
  this.boundMessageHandler = async (message: Message) => {
    await this.handleMessage(message);
  };
  
  this.discordClient.on('messageCreate', this.boundMessageHandler);
  this.isListening = true;
}
```

**2. Properly Remove Listener**
```typescript
stop(): void {
  if (!this.isListening) {
    return;
  }
  
  // ✅ Remove specific listener using stored reference
  if (this.boundMessageHandler) {
    this.discordClient.off('messageCreate', this.boundMessageHandler);
    this.boundMessageHandler = undefined;
  }
  
  this.isListening = false;
}
```

**3. Stop Before Updating**
```typescript
// In announcement.commands.ts
if (!announcementRelay) {
  // Create new instance
  announcementRelay = new AnnouncementRelayManager(...);
  announcementRelay.start();
} else {
  // ✅ Stop old instance first
  announcementRelay.stop();
  
  // Update config
  announcementRelay.updateConfig({...});
  
  // ✅ Restart with new config
  announcementRelay.start();
}
```

### Fixed Flow

```
1. Bot starts → Instance A created → Listener A registered
2. User runs /announcement-setup:
   - Instance A.stop() called → Listener A removed
   - Instance A config updated
   - Instance A.start() called → New Listener A registered
3. Message sent → Only new Listener A fires → Message sent once ✅
```

### Changes Made

**Files Modified:**
1. `src/managers/announcement-relay.manager.ts`
   - Added `boundMessageHandler` property
   - Modified `start()` to store handler reference
   - Modified `stop()` to properly remove listener

2. `src/commands/announcement.commands.ts`
   - Added `stop()` call before updating config
   - Added `start()` call after updating config
   - Updated log message to indicate restart

### Testing

**Test Case 1: Initial Setup**
```
1. Run /announcement-setup
2. Send message in private channel
3. Verify message appears once in each public channel ✅
```

**Test Case 2: Update Configuration**
```
1. Run /announcement-setup (first time)
2. Send message → Verify sent once ✅
3. Run /announcement-setup again (update)
4. Send message → Verify sent once ✅
```

**Test Case 3: Multiple Updates**
```
1. Run /announcement-setup 3 times
2. Send message
3. Verify message sent once (not 3 times) ✅
```

### Prevention

To prevent similar issues in the future:

**1. Always Store Event Handler References**
```typescript
// ❌ Bad - Can't remove later
client.on('event', async () => { ... });

// ✅ Good - Can be removed
this.handler = async () => { ... };
client.on('event', this.handler);
```

**2. Always Implement Cleanup**
```typescript
class Manager {
  private handler?: () => void;
  
  start() {
    this.handler = () => { ... };
    client.on('event', this.handler);
  }
  
  stop() {
    if (this.handler) {
      client.off('event', this.handler);
      this.handler = undefined;
    }
  }
}
```

**3. Stop Before Restart**
```typescript
// ❌ Bad - Accumulates listeners
manager.updateConfig({...});
manager.start();

// ✅ Good - Cleans up first
manager.stop();
manager.updateConfig({...});
manager.start();
```

### Related Issues

This fix also prevents:
- Memory leaks from accumulated event listeners
- Performance degradation from multiple handlers
- Unexpected behavior from stale instances

### Verification

After deploying this fix:

1. **Check Logs**: Look for "AnnouncementRelayManager stopped" and "restarted" messages
2. **Monitor Relay**: Send test messages and verify single delivery
3. **Update Config**: Run `/announcement-setup` multiple times and verify no duplicates

### Rollback Plan

If issues occur:
1. Revert to previous commit
2. Restart bot
3. Avoid running `/announcement-setup` multiple times
4. Report issue for investigation

---

**Fixed By**: Kiro AI Assistant  
**Date**: 2026-02-22  
**Commit**: (pending)  
**Status**: ✅ Fixed and Tested
