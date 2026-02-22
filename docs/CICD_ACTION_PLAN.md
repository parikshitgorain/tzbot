# CI/CD Improvement Action Plan

## Quick Reference

**Status**: 🟡 Production Ready with Improvements Needed  
**Priority Fixes**: 3 Critical, 3 High, 3 Medium  
**Estimated Effort**: 2-3 days for critical fixes

---

## Critical Fixes (Do First) 🔴

### 1. Add Database Migration Automation
**Priority**: 🔴 Critical  
**Effort**: 4 hours  
**Impact**: Prevents manual errors, ensures schema consistency

**Implementation**:
```yaml
# Add to cd-release.yml after "Setup environment variables"
- name: Run database migrations
  run: |
    ssh -i ~/.ssh/deploy_key \
      -o StrictHostKeyChecking=no \
      ${{ secrets.VPS_USER }}@${{ steps.dns.outputs.vps_ip }} \
      "cd /var/www/tzbot/current && npm run migrate"
```

**Files to modify**:
- `.github/workflows/cd-release.yml` (add migration step)
- `deployment/scripts/deploy.sh` (add migration execution)

---

### 2. Improve Health Checks
**Priority**: 🔴 Critical  
**Effort**: 3 hours  
**Impact**: Catches deployment failures before they affect users

**Changes needed**:
```bash
# In health-check.sh
MAX_WAIT_TIME=180  # Increase from 60 to 180 seconds

# Add database check
check_database_connection() {
    log_info "Checking database connection..."
    if node "$CURRENT_DIR/dist/core/database/health-check.js" 2>/dev/null; then
        log_info "Database connection is healthy"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Make Discord check mandatory after startup
check_discord_connection() {
    # ... existing code ...
    if [ $elapsed -gt 60 ]; then  # After 60s, Discord must be connected
        if ! node "$CURRENT_DIR/dist/utils/health-check.js" 2>/dev/null; then
            log_error "Discord connection failed after startup period"
            return 1
        fi
    fi
}
```

**Files to modify**:
- `deployment/scripts/health-check.sh`
- Create `src/core/database/health-check.ts` (new file)

---

### 3. Add Database Backup Before Deployment
**Priority**: 🔴 Critical  
**Effort**: 2 hours  
**Impact**: Enables safe rollback, prevents data loss

**Implementation**:
```bash
# Create deployment/scripts/backup-database.sh
#!/bin/bash
BACKUP_DIR="/var/www/tzbot/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Extract database URL components
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/backup_$TIMESTAMP.sql"

# Keep only last 30 days of backups
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +30 -delete

echo "Backup created: $BACKUP_DIR/backup_$TIMESTAMP.sql"
```

**Add to cd-release.yml**:
```yaml
- name: Backup database
  run: |
    ssh -i ~/.ssh/deploy_key \
      -o StrictHostKeyChecking=no \
      ${{ secrets.VPS_USER }}@${{ steps.dns.outputs.vps_ip }} \
      "export DATABASE_URL='${{ secrets.DATABASE_URL }}' && \
       bash /var/www/tzbot/deployment/scripts/backup-database.sh"
```

**Files to create**:
- `deployment/scripts/backup-database.sh` (new file)

**Files to modify**:
- `.github/workflows/cd-release.yml` (add backup step)

---

## High Priority Fixes (Do Next) 🟡

### 4. Implement Smoke Tests
**Priority**: 🟡 High  
**Effort**: 4 hours  
**Impact**: Verifies bot functionality after deployment

**Implementation**:
```typescript
// Create src/utils/smoke-test.ts
import { Client } from 'discord.js';

export async function runSmokeTests(): Promise<boolean> {
  try {
    const client = new Client({ intents: [] });
    await client.login(process.env.DISCORD_TOKEN);
    
    // Test 1: Bot is logged in
    if (!client.user) return false;
    
    // Test 2: Can fetch guild
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID!);
    if (!guild) return false;
    
    // Test 3: Database connection
    const db = await Database.getInstance();
    await db.query('SELECT 1');
    
    await client.destroy();
    return true;
  } catch (error) {
    console.error('Smoke test failed:', error);
    return false;
  }
}
```

**Add to health-check.sh**:
```bash
# Run smoke tests
if node "$CURRENT_DIR/dist/utils/smoke-test.js"; then
    log_info "Smoke tests passed"
else
    log_error "Smoke tests failed"
    return 1
fi
```

**Files to create**:
- `src/utils/smoke-test.ts` (new file)

**Files to modify**:
- `deployment/scripts/health-check.sh`

---

### 5. Add Deployment Metrics & Monitoring
**Priority**: 🟡 High  
**Effort**: 3 hours  
**Impact**: Track deployment success, identify issues faster

**Implementation**:
```bash
# Create deployment/scripts/metrics.sh
#!/bin/bash
send_metric() {
    local metric_name="$1"
    local value="$2"
    local tags="$3"
    
    # Send to Discord webhook with metrics
    curl -X POST "$DISCORD_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{
        \"embeds\": [{
          \"title\": \"📊 Deployment Metric\",
          \"fields\": [
            {\"name\": \"Metric\", \"value\": \"$metric_name\"},
            {\"name\": \"Value\", \"value\": \"$value\"},
            {\"name\": \"Tags\", \"value\": \"$tags\"}
          ]
        }]
      }"
}

# Track deployment duration
DEPLOY_START=$(date +%s)
# ... deployment happens ...
DEPLOY_END=$(date +%s)
DURATION=$((DEPLOY_END - DEPLOY_START))
send_metric "deployment_duration" "$DURATION" "env=production"
```

**Files to create**:
- `deployment/scripts/metrics.sh` (new file)

**Files to modify**:
- `.github/workflows/cd-release.yml` (add metrics collection)
- `deployment/scripts/deploy.sh` (track timing)

---

### 6. Improve Rollback with Database Support
**Priority**: 🟡 High  
**Effort**: 3 hours  
**Impact**: Safe rollback including database changes

**Implementation**:
```bash
# Modify rollback.sh
rollback_database() {
    local backup_file="$1"
    log_step "Rolling back database..."
    
    if [ -f "$backup_file" ]; then
        psql "$DATABASE_URL" < "$backup_file"
        log_info "Database rolled back successfully"
    else
        log_warn "No database backup found, skipping database rollback"
    fi
}

# Add to rollback flow
BACKUP_FILE="$DEPLOY_BASE/backups/backup_${TIMESTAMP}.sql"
if [ -f "$BACKUP_FILE" ]; then
    read -p "Rollback database as well? (y/n) " -n 1 -r
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rollback_database "$BACKUP_FILE"
    fi
fi
```

**Files to modify**:
- `deployment/scripts/rollback.sh`

---

## Medium Priority (Nice to Have) 🟢

### 7. Optimize Build with Docker
**Priority**: 🟢 Medium  
**Effort**: 6 hours  
**Impact**: Faster, more consistent builds

**Implementation**:
```dockerfile
# Create Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
CMD ["node", "dist/index.js"]
```

**Files to create**:
- `Dockerfile` (new file)
- `.dockerignore` (new file)

---

### 8. Add Monitoring Integration
**Priority**: 🟢 Medium  
**Effort**: 4 hours  
**Impact**: Better visibility into production

**Options**:
- Sentry for error tracking
- Datadog for metrics
- Prometheus + Grafana for custom metrics

---

### 9. Improve Documentation
**Priority**: 🟢 Medium  
**Effort**: 3 hours  
**Impact**: Easier troubleshooting and onboarding

**Documents to create**:
- `docs/RUNBOOK.md` - Common issues and solutions
- `docs/ROLLBACK_PROCEDURE.md` - Step-by-step rollback guide
- `docs/INCIDENT_RESPONSE.md` - What to do when things break

---

## Implementation Timeline

### Week 1: Critical Fixes
- **Day 1**: Database migration automation (4h)
- **Day 2**: Improve health checks (3h) + Database backup (2h)
- **Day 3**: Testing and validation (3h)

### Week 2: High Priority
- **Day 1**: Smoke tests (4h)
- **Day 2**: Deployment metrics (3h)
- **Day 3**: Rollback improvements (3h)

### Week 3: Medium Priority
- **Day 1-2**: Docker optimization (6h)
- **Day 3**: Monitoring integration (4h)
- **Day 4**: Documentation (3h)

---

## Testing Plan

After each fix, test:

1. **Local Testing**
   - Run scripts locally
   - Verify syntax and logic
   - Test error handling

2. **Staging Testing**
   - Deploy to staging environment
   - Run full deployment cycle
   - Test rollback procedure

3. **Production Validation**
   - Monitor first production deployment
   - Verify metrics are collected
   - Check notifications work

---

## Success Criteria

### Critical Fixes Complete When:
- [ ] Database migrations run automatically
- [ ] Health checks verify Discord + Database
- [ ] Database backups created before each deployment
- [ ] Zero manual intervention needed for normal deployments

### High Priority Complete When:
- [ ] Smoke tests verify bot functionality
- [ ] Deployment metrics tracked and visible
- [ ] Rollback includes database restoration
- [ ] Deployment success rate > 95%

### Medium Priority Complete When:
- [ ] Docker builds working
- [ ] Monitoring integrated
- [ ] Documentation complete
- [ ] Team trained on new procedures

---

## Rollout Strategy

1. **Implement fixes in feature branch**
2. **Test in Development environment**
3. **Deploy to staging for validation**
4. **Monitor first production deployment closely**
5. **Document any issues encountered**
6. **Iterate based on feedback**

---

## Risk Mitigation

### Risks During Implementation:
- **Breaking existing deployments**: Test thoroughly in staging
- **Database backup failures**: Add error handling and alerts
- **Increased deployment time**: Optimize critical path
- **New bugs introduced**: Add comprehensive testing

### Mitigation Strategies:
- Keep old deployment process available as fallback
- Implement changes incrementally
- Monitor closely after each change
- Have rollback plan for each fix

---

## Questions to Answer

Before starting implementation:

1. **Database Backup**: Where should backups be stored? (VPS, S3, etc.)
2. **Monitoring**: Which monitoring service to use?
3. **Docker**: Should we containerize the entire application?
4. **Smoke Tests**: Which commands/features are critical to test?
5. **Metrics**: What metrics are most important to track?

---

## Resources Needed

- **Time**: 2-3 days for critical fixes, 1-2 weeks for all fixes
- **Access**: VPS SSH access, GitHub Actions access
- **Tools**: Database backup tools, monitoring service account
- **Testing**: Staging environment for validation

---

## Next Steps

1. **Review this plan** with the team
2. **Prioritize fixes** based on current pain points
3. **Assign owners** for each fix
4. **Create GitHub issues** for tracking
5. **Start with Critical Fix #1** (Database migrations)

---

**Document Version**: 1.0  
**Created**: 2026-02-22  
**Owner**: DevOps Team  
**Status**: Ready for Implementation
