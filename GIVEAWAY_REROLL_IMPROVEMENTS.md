# Giveaway Reroll Improvements

## Issue
User encountered "No remaining entries available for reroll" error when attempting to reroll a giveaway winner. The error message was not informative enough to understand why the reroll failed.

Additionally, the command format shown in the winner announcement was missing a space before `@user`.

## Root Cause Analysis
The `rerollWinner()` method in `src/managers/giveaway.manager.ts` filters out all current winners from the entry list to find available candidates for reroll. When `availableEntries.length === 0`, it means all participants have already won.

This can occur in two scenarios:
1. **Single entry giveaway**: Only one person entered and won - no other entries exist to reroll
2. **All entries are winners**: The number of winners equals the total number of entries (e.g., 3 entries, 3 winners)

## Improvements Made

### 1. Enhanced Error Message
**Before:**
```typescript
throw new Error('No remaining entries available for reroll');
```

**After:**
```typescript
throw new Error(
  `No remaining entries available for reroll. Total entries: ${allEntries.length}, Current winners: ${giveaway.winners?.length || 0}. All participants have already won.`
);
```

The new error message provides:
- Total number of entries in the giveaway
- Current number of winners
- Clear explanation that all participants have already won

### 2. Added Debug Logging
Added detailed logging before the reroll attempt to help diagnose issues:

```typescript
logger.debug('Reroll winner - entry analysis', {
  giveawayId,
  totalEntries: allEntries.length,
  currentWinners: giveaway.winners?.length || 0,
  availableForReroll: availableEntries.length,
  oldWinnerId,
});
```

This logging will appear in the bot logs and help moderators understand:
- How many total entries the giveaway had
- How many winners are currently selected
- How many entries are available for reroll
- Which winner is being rerolled

### 3. Fixed Command Format Documentation
**Before:**
```
/giveaway reroll giveaway_id:cd2f6b4f-a7c3-abcb-d456-159479af5353 winner:@user
```

**After:**
```
/giveaway reroll giveaway_id:cd2f6b4f-a7c3-abcb-d456-159479af5353 winner: @user
```

Added a space before `@user` to match Discord's slash command format requirements.

## User Experience Impact

### Before
Moderators would see:
```
❌ Failed to reroll winner: No remaining entries available for reroll
```

And the command format shown was:
```
/giveaway reroll giveaway_id:xxx winner:@user
```

### After
Moderators will see:
```
❌ Failed to reroll winner: No remaining entries available for reroll. Total entries: 3, Current winners: 3. All participants have already won.
```

And the command format shown is:
```
/giveaway reroll giveaway_id:xxx winner: @user
```

This makes it immediately clear that the giveaway had 3 entries and all 3 are already winners, so there's no one left to reroll to. The command format is also now correct with the required space.

## Testing
- All 14 giveaway manager tests pass
- No breaking changes to existing functionality
- Error handling remains robust

## Files Modified
- `src/managers/giveaway.manager.ts` - Enhanced error message, added debug logging in `rerollWinner()` method, and fixed command format in `announceWinners()` method

## Recommendation
When this error occurs, moderators should:
1. Check the giveaway details to see total entries vs winners
2. If all entries are winners, they cannot reroll (this is expected behavior)
3. Consider creating a new giveaway if they want to select different winners
