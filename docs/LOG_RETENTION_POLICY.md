# Log Retention Policy

## Overview

TZBot implements a comprehensive logging system with automatic log rotation and retention policies to ensure compliance with data retention requirements and efficient disk space management.

## Retention Periods

All log files are automatically rotated daily and retained for a maximum of **30 days**.

### Log Types and Retention

| Log Type | File Pattern | Retention Period | Max File Size |
|----------|--------------|------------------|---------------|
| General Logs | `tzbot-YYYY-MM-DD.log` | 14 days | 10 MB |
| Error Logs | `error-YYYY-MM-DD.log` | 30 days | 10 MB |
| Moderation Logs | `moderation-YYYY-MM-DD.log` | 30 days | 10 MB |

## Automatic Log Rotation

Logs are automatically rotated using `winston-daily-rotate-file`:

- **Daily Rotation**: New log file created each day
- **Size-Based Rotation**: New file created when size exceeds 10 MB
- **Automatic Cleanup**: Files older than retention period are automatically deleted
- **Compression**: Old log files can be compressed (optional)

## Log File Locations

```
logs/
├── tzbot-2026-02-22.log          # General application logs
├── error-2026-02-22.log          # Error logs only
├── moderation-2026-02-22.log     # Moderation action logs
└── .gitkeep                      # Keeps logs directory in git
```

## Manual Cleanup

If you need to manually clean up old logs:

```bash
# Run the cleanup script
npm run logs:cleanup

# Or directly
tsx scripts/cleanup-old-logs.ts
```

The cleanup script will:
- Scan the `logs/` directory
- Identify files older than 30 days
- Delete old log files
- Report freed disk space

## Log Content

### General Logs (`tzbot-*.log`)
- Application startup/shutdown
- Feature usage
- System state transitions
- Performance metrics
- API requests

### Error Logs (`error-*.log`)
- Application errors
- Stack traces
- Error context
- Failed operations
- Exception details

### Moderation Logs (`moderation-*.log`)
- Moderation actions (ban, kick, timeout, warn)
- Message deletions
- Violation detections
- Malicious link detections
- User warnings

## Compliance

### Data Retention
- **Maximum Retention**: 30 days for all log types
- **Automatic Deletion**: Files older than retention period are automatically removed
- **No Manual Intervention**: Rotation and cleanup happen automatically

### Privacy Considerations
- Logs may contain user IDs and message content
- Logs are stored locally on the server
- Logs are not transmitted to external services
- Old logs are permanently deleted after retention period

## Configuration

Log retention is configured in `src/core/logger/logger.ts`:

```typescript
// General logs - 14 days
const rotatingFileTransport = new DailyRotateFile({
  filename: 'logs/tzbot-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '14d',
});

// Error logs - 30 days
const errorRotatingTransport = new DailyRotateFile({
  filename: 'logs/error-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '30d',
  level: 'error',
});

// Moderation logs - 30 days
const moderationRotatingTransport = new DailyRotateFile({
  filename: 'logs/moderation-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '30d',
  level: 'info',
});
```

## Monitoring

### Check Log Disk Usage

```bash
# Windows
dir logs /s

# Linux/Mac
du -sh logs/
ls -lh logs/
```

### View Recent Logs

```bash
# View latest general log
type logs\tzbot-2026-02-22.log

# View latest error log
type logs\error-2026-02-22.log

# View latest moderation log
type logs\moderation-2026-02-22.log
```

### Tail Logs in Real-Time

```bash
# Windows PowerShell
Get-Content logs\tzbot-2026-02-22.log -Wait -Tail 50

# Linux/Mac
tail -f logs/tzbot-2026-02-22.log
```

## Best Practices

1. **Regular Monitoring**: Check log disk usage weekly
2. **Backup Important Logs**: Archive critical logs before they expire
3. **Review Error Logs**: Check error logs daily for issues
4. **Moderation Audit**: Review moderation logs for compliance
5. **Disk Space**: Ensure adequate disk space for log rotation

## Troubleshooting

### Logs Not Rotating

1. Check file permissions on `logs/` directory
2. Verify winston-daily-rotate-file is installed
3. Check for disk space issues
4. Review application logs for rotation errors

### Disk Space Issues

1. Run manual cleanup: `npm run logs:cleanup`
2. Reduce retention period if needed
3. Reduce max file size if needed
4. Archive old logs to external storage

### Missing Logs

1. Check if application is running
2. Verify log level configuration
3. Check file permissions
4. Review winston configuration

## Scheduled Cleanup (Optional)

For production environments, consider scheduling automatic cleanup:

### Windows Task Scheduler

```powershell
# Create scheduled task to run daily at 2 AM
schtasks /create /tn "TZBot Log Cleanup" /tr "npm run logs:cleanup" /sc daily /st 02:00
```

### Linux Cron

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/tzbot && npm run logs:cleanup
```

## Summary

- ✅ All logs automatically rotate daily
- ✅ Maximum retention: 30 days
- ✅ Automatic cleanup of old files
- ✅ Manual cleanup script available
- ✅ Compliant with data retention policies
- ✅ Efficient disk space management

## Related Documentation

- [Logger Implementation](../src/core/logger/README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Deployment Guide](../.github/DEPLOYMENT_GUIDE.md)
