# Giveaway Feature Enhancements - Complete

## Summary

Successfully implemented all requested enhancements to the giveaway feature:

1. ✅ Auto DM to winners with @mention tagging
2. ✅ Optional `condition` field for winner requirements
3. ✅ Interactive reroll feature for moderators

## Changes Made

### 1. Database Schema (Migration 003)

**Files:**
- `src/core/database/schema/003_giveaway_enhancements.sql`
- `src/core/database/schema/003_giveaway_enhancements_down.sql`

**Changes:**
- Added `condition` TEXT column to `giveaways` table
- Added `winners` JSONB column to `giveaways` table
- Created GIN index on `winners` column for fast lookups

**To Apply Migration:**
```bash
npm run migrate
```

### 2. Type Definitions

**File:** `src/types/models.ts`

**Changes:**
- Added `condition?: string` to `Giveaway` interface
- Added `winners?: string[]` to `Giveaway` interface

### 3. Giveaway Manager

**File:** `src/managers/giveaway.manager.ts`

**Changes:**
- Updated `CreateGiveawayOptions` interface to include `condition?: string`
- Modified `createGiveaway()` to store condition and initialize winners array
- Updated `announceWinners()` to:
  - Send DM with @mention: `<@${winnerId}> 🎉 You Won!`
  - Include condition in DM if provided
  - Store winner IDs in database
  - Show reroll command in announcement (code block format)
- Added `getActiveGiveaways(guildId: string)` method
- Added `rerollWinner(giveawayId, oldWinnerId, guildId)` method:
  - Validates giveaway exists and is ended
  - Validates oldWinnerId is in winners array
  - Selects new winner from remaining entries (excluding current winners)
  - Updates winners array in database
  - Sends DM to new winner with @mention and condition
  - Announces reroll in channel
  - Updates giveaway message

### 4. Giveaway Repository

**File:** `src/core/database/repositories/GiveawayRepository.ts`

**Changes:**
- Updated `save()` to handle `condition` and `winners` fields
- Updated `get()` to retrieve `condition` and `winners` fields
- Updated `getActive()` to retrieve `condition` and `winners` fields
- Updated `getByChannel()` to retrieve `condition` and `winners` fields
- Added `updateWinners(giveawayId, winners)` method

### 5. Giveaway Commands

**File:** `src/commands/giveaway.commands.ts`

**Changes:**
- Added `condition` parameter to `/giveaway create` command (optional, max 512 chars)
- Added `/giveaway reroll` subcommand with `giveaway_id` and `winner` parameters
- Added `handleRerollWinner()` function to handle reroll command
- Updated command handler to route reroll subcommand

### 6. Documentation

**File:** `docs/COMMAND_REFERENCE.md`

**Changes:**
- Updated `/giveaway create` documentation with `condition` parameter
- Added `/giveaway reroll` command documentation
- Updated permission table to include reroll command

## Feature Details

### Winner DM Format

When a winner is selected, they receive a DM with:

```
<@123456789> 🎉 You Won!

Congratulations! You won the giveaway: **Giveaway Title**

**Next Steps:**
[condition text if provided]
```

If no condition is provided:
```
<@123456789> 🎉 You Won!

Congratulations! You won the giveaway: **Giveaway Title**

Check the giveaway channel for more details!
```

### Winner Announcement Format

When winners are announced in the channel:

```
🎉 Giveaway Title - Winners!

Congratulations to the winners!

**Winners:** @Winner1, @Winner2, @Winner3

**Moderators:** To reroll a winner, use:
```
/giveaway reroll giveaway_id:abc123 winner:@user
```
```

### Reroll Announcement Format

When a winner is rerolled:

```
🔄 Giveaway Title - Winner Rerolled

A winner has been rerolled!

**Previous Winner:** @OldWinner
**New Winner:** @NewWinner

Congratulations to the new winner!
```

## Usage Examples

### Create Giveaway with Condition

```
/giveaway create 
  title:Custom Prize 
  description:Win a custom prize! 
  duration:1440 
  winners:1 
  condition:DM me your email address within 24 hours to claim your prize
```

### Reroll a Winner

```
/giveaway reroll 
  giveaway_id:abc123def456 
  winner:@OldWinner
```

## Testing Checklist

- [ ] Run database migration: `npm run migrate`
- [ ] Restart bot to load new code
- [ ] Create test giveaway with condition
- [ ] Wait for giveaway to end or cancel it
- [ ] Verify winner DM includes @mention and condition
- [ ] Verify announcement includes reroll command
- [ ] Test reroll command with valid winner
- [ ] Verify new winner receives DM
- [ ] Verify reroll announcement appears
- [ ] Test reroll with invalid giveaway ID (should fail)
- [ ] Test reroll with non-winner user (should fail)
- [ ] Test reroll with active giveaway (should fail)

## Next Steps

1. Run database migration: `npm run migrate`
2. Restart the bot to load the new compiled code
3. Test the complete flow with a real giveaway
4. Monitor logs for any issues

## Notes

- The `condition` field is optional and can be up to 512 characters
- Winners are stored in the database for reroll functionality
- Reroll only works on ended giveaways
- Reroll selects from remaining entries (excluding current winners)
- Only moderators with MANAGE_EVENTS permission can use reroll
- DMs include @mention tagging for better notification
