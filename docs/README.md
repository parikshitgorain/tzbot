# TZBOT Documentation

Welcome to the TZBOT documentation! This directory contains comprehensive guides for users, moderators, and administrators.

## Documentation Overview

### For End Users

**[User Guide](./USER_GUIDE.md)** - Complete guide for using TZBOT
- Getting started with TZBOT
- Account linking with Kick.com
- All slash commands explained with examples
- How to participate in giveaways
- Understanding chat rain rewards
- AI auto-responder usage
- Troubleshooting common issues
- Privacy and data management

**Best for:** Regular server members who want to use TZBOT features

---

### For Moderators

**[Moderator Quick Reference](./MODERATOR_QUICK_REFERENCE.md)** - Fast reference for moderators
- Quick command reference
- Moderation actions guide
- Giveaway management
- Chat rain configuration
- Announcement relay system
- Monitoring and logs
- Emergency procedures
- Security checklist

**Best for:** Moderators who need quick access to commands and procedures

---

### For Administrators

**[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment instructions
- Prerequisites and requirements
- Environment variable configuration
- Database and Redis setup
- Discord bot configuration
- Kick API integration
- Google Safe Browsing setup
- Deployment options (VPS, Docker, systemd)
- HTTPS and webhook configuration
- Monitoring and alerting
- Backup and disaster recovery

**Best for:** Server administrators setting up or maintaining TZBOT

**[Quick Start Guide](./QUICK_START.md)** - Get running in 15 minutes
- Minimal setup steps
- Essential configuration only
- Quick testing procedures
- Common startup issues

**Best for:** Quick testing or development setup

---

### For Developers

**[Project Structure](./project-structure.md)** - Code organization
- Directory structure
- Module descriptions
- Architecture overview
- Development guidelines

**Best for:** Developers contributing to TZBOT

**[Pusher Implementation](./pusher-client-implementation.md)** - Kick chat integration
- Pusher client setup
- Kick chat monitoring
- Badge detection
- Role synchronization

**Best for:** Understanding Kick.com integration

---

### Troubleshooting

**[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Comprehensive problem solving
- Bot startup issues
- Command problems
- Account linking issues
- Giveaway troubleshooting
- Chat rain problems
- Moderation issues
- Performance optimization
- Database and network issues

**Best for:** Diagnosing and fixing issues

---

## Quick Links by Task

### I want to...

**Set up TZBOT for the first time**
→ Start with [Quick Start Guide](./QUICK_START.md)
→ Then read [Deployment Guide](./DEPLOYMENT.md) for production

**Use TZBOT as a regular user**
→ Read [User Guide](./USER_GUIDE.md)

**Moderate with TZBOT**
→ Check [Moderator Quick Reference](./MODERATOR_QUICK_REFERENCE.md)

**Fix a problem**
→ See [Troubleshooting Guide](./TROUBLESHOOTING.md)

**Understand the code**
→ Review [Project Structure](./project-structure.md)

**Configure Kick integration**
→ Read [Pusher Implementation](./pusher-client-implementation.md)
→ And [Deployment Guide - Kick API Setup](./DEPLOYMENT.md#kick-api-setup)

---

## Feature Documentation

### Core Features

| Feature | User Guide | Moderator Guide | Deployment Guide |
|---------|-----------|----------------|------------------|
| Account Linking | [Link](./USER_GUIDE.md#account-linking) | [Link](./MODERATOR_QUICK_REFERENCE.md#monitoring-and-logs) | [Link](./DEPLOYMENT.md#kick-api-setup) |
| Slash Commands | [Link](./USER_GUIDE.md#slash-commands) | [Link](./MODERATOR_QUICK_REFERENCE.md#quick-command-reference) | [Link](./DEPLOYMENT.md#discord-bot-setup) |
| Giveaways | [Link](./USER_GUIDE.md#giveaways) | [Link](./MODERATOR_QUICK_REFERENCE.md#giveaway-management) | - |
| Chat Rain | [Link](./USER_GUIDE.md#chat-rain) | [Link](./MODERATOR_QUICK_REFERENCE.md#chat-rain-configuration) | - |
| Moderation | [Link](./USER_GUIDE.md#moderation-features) | [Link](./MODERATOR_QUICK_REFERENCE.md#moderation-actions) | - |
| Announcements | [Link](./USER_GUIDE.md#announcements) | [Link](./MODERATOR_QUICK_REFERENCE.md#announcement-relay) | - |
| AI Responder | [Link](./USER_GUIDE.md#ai-auto-responder-optional) | [Link](./MODERATOR_QUICK_REFERENCE.md#ai-auto-responder) | [Link](./DEPLOYMENT.md#environment-variables) |

---

## Documentation by Role

### Regular Users

1. **Start here:** [User Guide](./USER_GUIDE.md)
2. **If you have issues:** [Troubleshooting - User Issues](./TROUBLESHOOTING.md#command-issues)
3. **Privacy concerns:** [User Guide - Privacy](./USER_GUIDE.md#privacy-and-data)

### Moderators

1. **Start here:** [Moderator Quick Reference](./MODERATOR_QUICK_REFERENCE.md)
2. **For detailed explanations:** [User Guide - Moderation](./USER_GUIDE.md#moderation-features)
3. **If something breaks:** [Troubleshooting - Moderation](./TROUBLESHOOTING.md#moderation-issues)

### Administrators

1. **First time setup:** [Quick Start](./QUICK_START.md) → [Deployment Guide](./DEPLOYMENT.md)
2. **Configuration:** [Deployment Guide - Environment Variables](./DEPLOYMENT.md#environment-variables)
3. **Maintenance:** [Deployment Guide - Monitoring](./DEPLOYMENT.md#monitoring-setup)
4. **Problems:** [Troubleshooting Guide](./TROUBLESHOOTING.md)

### Developers

1. **Code structure:** [Project Structure](./project-structure.md)
2. **Kick integration:** [Pusher Implementation](./pusher-client-implementation.md)
3. **Setup dev environment:** [Quick Start](./QUICK_START.md)
4. **Deployment:** [Deployment Guide](./DEPLOYMENT.md)

---

## Common Scenarios

### Scenario: New Server Setup

1. Read [Quick Start Guide](./QUICK_START.md) (15 minutes)
2. Follow [Deployment Guide](./DEPLOYMENT.md) for production setup
3. Share [User Guide](./USER_GUIDE.md) with server members
4. Give [Moderator Quick Reference](./MODERATOR_QUICK_REFERENCE.md) to moderators
5. Bookmark [Troubleshooting Guide](./TROUBLESHOOTING.md) for issues

### Scenario: User Can't Link Account

1. User checks [User Guide - Account Linking](./USER_GUIDE.md#account-linking)
2. If still broken, check [Troubleshooting - Account Linking](./TROUBLESHOOTING.md#account-linking-issues)
3. Moderator checks logs using [Moderator Guide - Monitoring](./MODERATOR_QUICK_REFERENCE.md#monitoring-and-logs)
4. Admin reviews [Deployment Guide - Kick Setup](./DEPLOYMENT.md#kick-api-setup)

### Scenario: Bot Performance Issues

1. Check [Troubleshooting - Performance](./TROUBLESHOOTING.md#performance-issues)
2. Review [Deployment Guide - Monitoring](./DEPLOYMENT.md#monitoring-setup)
3. Optimize using [Moderator Guide - Performance](./MODERATOR_QUICK_REFERENCE.md#performance-optimization)
4. Consider [Deployment Guide - Scaling](./DEPLOYMENT.md#deployment-options)

### Scenario: Creating a Giveaway

1. Moderator reads [Moderator Guide - Giveaways](./MODERATOR_QUICK_REFERENCE.md#giveaway-management)
2. Creates giveaway using commands
3. Users enter following [User Guide - Giveaways](./USER_GUIDE.md#giveaways)
4. If issues, check [Troubleshooting - Giveaways](./TROUBLESHOOTING.md#giveaway-issues)

---

## Documentation Standards

### For Users
- Clear, simple language
- Step-by-step instructions
- Visual examples where helpful
- Common issues addressed

### For Moderators
- Quick reference format
- Command examples
- Best practices
- Emergency procedures

### For Administrators
- Technical details
- Configuration options
- Security considerations
- Performance optimization

### For Developers
- Code organization
- Architecture decisions
- Integration details
- Development workflow

---

## Getting Help

### Self-Service

1. **Search this documentation** - Use Ctrl+F to search within documents
2. **Check troubleshooting** - [Troubleshooting Guide](./TROUBLESHOOTING.md) covers common issues
3. **Review logs** - Most issues show up in logs with clear error messages

### Community Support

1. **Server support channel** - Ask in your server's designated support channel
2. **Moderators** - Contact server moderators for help
3. **Administrator** - Reach out to the bot administrator for technical issues

### Reporting Issues

When reporting issues, include:
- What you were trying to do
- What happened instead
- Error messages (from bot or logs)
- Steps to reproduce
- Your role (user/moderator/admin)

**For users:** Describe the issue in the support channel
**For moderators:** Include relevant log excerpts
**For admins:** Collect diagnostic information from [Troubleshooting](./TROUBLESHOOTING.md#collecting-diagnostic-information)

---

## Contributing to Documentation

### Reporting Documentation Issues

If you find:
- Incorrect information
- Unclear instructions
- Missing topics
- Broken links

Please report to the bot administrator or create an issue (if open source).

### Suggesting Improvements

We welcome suggestions for:
- Additional examples
- Clearer explanations
- New troubleshooting scenarios
- Better organization

### Writing Style

When contributing:
- Use clear, simple language
- Provide examples
- Include code snippets where relevant
- Test all instructions
- Update table of contents

---

## Documentation Versions

### Current Version: 1.0.0 (2025-02-21)

**Included:**
- Complete user guide
- Moderator quick reference
- Comprehensive deployment guide
- Troubleshooting guide
- Project structure documentation
- Pusher implementation guide

**Coverage:**
- All core features documented
- All commands explained
- Common issues addressed
- Setup procedures complete

---

## Quick Reference Card

### Essential Commands

```bash
# User Commands
/link kick_username:YourUsername    # Link accounts
/checklink                          # Check link status
/deletemydata                       # Delete your data

# Moderator Commands
/ban user:@User reason:Reason       # Ban user
/timeout user:@User duration:60     # Timeout user
/warn user:@User reason:Reason      # Warn user
/config                             # View configuration
```

### Essential Files

```
docs/
├── USER_GUIDE.md                   # For users
├── MODERATOR_QUICK_REFERENCE.md    # For moderators
├── DEPLOYMENT.md                   # For admins
├── QUICK_START.md                  # Quick setup
├── TROUBLESHOOTING.md              # Problem solving
├── project-structure.md            # Code organization
└── pusher-client-implementation.md # Kick integration
```

### Essential Links

- User Guide: [./USER_GUIDE.md](./USER_GUIDE.md)
- Moderator Guide: [./MODERATOR_QUICK_REFERENCE.md](./MODERATOR_QUICK_REFERENCE.md)
- Deployment: [./DEPLOYMENT.md](./DEPLOYMENT.md)
- Troubleshooting: [./TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## Feedback

We're constantly improving this documentation. If you have feedback:

1. **What worked well?** - Let us know what was helpful
2. **What was confusing?** - Tell us what needs clarification
3. **What's missing?** - Suggest topics to add
4. **What's wrong?** - Report errors or outdated information

Contact the bot administrator or use your server's feedback channel.

---

**Thank you for using TZBOT!** 🎉

*Last updated: 2025-02-21*
*Documentation version: 1.0.0*
*Bot version: 1.0.0*

