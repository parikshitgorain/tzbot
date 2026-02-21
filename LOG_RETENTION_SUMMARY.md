# Log Retention Policy - Implementation Summary

## ✅ Completed: 30-Day Maximum Retention Enforced

### Changes Made

**1. Updated Log Retention Configuration** ✅
- **Moderation Logs**: Changed from 90 days → 30 days
- **Error Logs**: Already at 30 days ✅
- **General Logs**: Already at 14 days ✅

### Current Log Retention Settings

| Log Type | File Pattern | Retention | Max Size | Status |
|----------|--------------|-----------|----------|--------|
| General | `tzbot-YYYY-MM-DD.log` | 14 days | 10 MB | ✅ Compliant |
| Error | `error-YYYY-MM-DD.log` | 30 days | 10 MB | ✅ Compliant |
| Moderation | `moderation-YYYY-MM-DD.log` | 30 days | 10 MB | ✅ Fixed |

**All log types now comply with the 30-day maximum retention policy.**

## Automatic Log Management

### Daily Rotation
- New log file created each day
- Files automatically named with date: `YYYY-MM-DD`
- Old files automatically deleted after retention period

### Size-Based Rotation
- New file created when size exceeds 10 MB
- Prevents individual files from growing too large
- Ensures consistent performance

### Automatic Cleanup
- Winston automatically deletes files older than retention period
- No manual intervention required
- Runs continuously while application is running

## Manual Cleanup Script

Added new script for manual log cleanup:

```bash
# Run cleanup script
npm run logs:cleanup
```

**What it does:**
- Scans `logs/` directory
- Identifies files older than 30 days
- Deletes old log files
- Reports freed disk space

**When to use:**
- After changing retention settings
- When disk space is low
- For manual audits
- Before backups

## Documentation

Created comprehensive documentation:

**File**: `docs/LOG_RETENTION_POLICY.md`

**Contents:**
- Retention periods for all log types
- Automatic rotation details
- Manual cleanup instructions
- Compliance information
- Monitoring commands
- Troubleshooting guide
- Best practices

## Verification

### Check Current Logs

```bash
# List all log files
dir logs

# Check log file ages
dir logs /o:d
```

### Current Log Files (as of Feb 22, 2026)
```
logs/
├── tzbot-2026-02-21.log          # 1 day old ✅
├── tzbot-2026-02-22.log          # Current ✅
├── error-2026-02-21.log          # 1 day old ✅
├── error-2026-02-22.log          # Current ✅
├── moderation-2026-02-21.log     # 1 day old ✅
├── moderation-2026-02-22.log     # Current ✅
└── .gitkeep                      # Preserved
```

**All logs are recent and within retention policy.**

## Compliance

### Data Retention Requirements
- ✅ No logs kept longer than 30 days
- ✅ Automatic deletion after retention period
- ✅ Manual cleanup script available
- ✅ Documentation complete

### Privacy Considerations
- Logs stored locally only
- Not transmitted to external services
- Automatically deleted after 30 days
- Contains user IDs and message content (necessary for moderation)

## Configuration Location

**File**: `src/core/logger/logger.ts`

**Key Configuration:**
```typescript
// General logs - 14 days
maxFiles: '14d'

// Error logs - 30 days
maxFiles: '30d'

// Moderation logs - 30 days (UPDATED)
maxFiles: '30d'  // Was: '90d'
```

## Monitoring

### Check Disk Usage

```bash
# Windows
dir logs /s

# Show total size
powershell "Get-ChildItem logs -Recurse | Measure-Object -Property Length -Sum"
```

### View Recent Logs

```bash
# Latest general log
type logs\tzbot-2026-02-22.log

# Latest error log
type logs\error-2026-02-22.log

# Latest moderation log
type logs\moderation-2026-02-22.log
```

### Real-Time Monitoring

```bash
# PowerShell - tail logs
Get-Content logs\tzbot-2026-02-22.log -Wait -Tail 50
```

## Best Practices

1. **Regular Monitoring**: Check log disk usage weekly
2. **Backup Critical Logs**: Archive important logs before 30-day expiry
3. **Review Error Logs**: Check daily for issues
4. **Audit Moderation**: Review moderation logs for compliance
5. **Disk Space**: Ensure adequate space for rotation

## Scheduled Cleanup (Optional)

For production, consider scheduling automatic cleanup:

### Windows Task Scheduler
```powershell
schtasks /create /tn "TZBot Log Cleanup" /tr "cd C:\path\to\tzbot && npm run logs:cleanup" /sc daily /st 02:00
```

### Benefits
- Ensures old logs are removed even if app is offline
- Runs during low-traffic hours
- Provides additional safety net
- Generates cleanup reports

## Summary

✅ **All log types now comply with 30-day maximum retention**
✅ **Automatic rotation and cleanup configured**
✅ **Manual cleanup script available**
✅ **Comprehensive documentation created**
✅ **No action required - system manages logs automatically**

## Quick Commands

```bash
# View log retention policy
cat docs/LOG_RETENTION_POLICY.md

# Run manual cleanup
npm run logs:cleanup

# Check current logs
dir logs

# View latest log
type logs\tzbot-2026-02-22.log
```

## Status

🟢 **Log Retention Policy: Fully Compliant**

- Maximum retention: 30 days
- Automatic cleanup: Enabled
- Manual cleanup: Available
- Documentation: Complete
- Monitoring: Configured

---

**Last Updated**: February 22, 2026
**Policy Version**: 1.0
**Compliance Status**: ✅ Compliant
