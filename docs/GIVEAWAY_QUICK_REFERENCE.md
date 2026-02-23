# Giveaway Quick Reference Guide

## Creating a Giveaway

### Basic Giveaway
```
/giveaway create
  title: "Prize Giveaway"
  description: "Win amazing prizes!"
  duration: 60
  winners: 1
```

### Giveaway with Host
```
/giveaway create
  title: "Community Giveaway"
  description: "Thanks to our sponsor!"
  duration: 1440
  winners: 3
  hosted_by: @SponsorName
```

### Giveaway with Role Requirements
```
/giveaway create
  title: "VIP Giveaway"
  description: "Exclusive for VIP members"
  duration: 720
  winners: 2
  role1: @VIP
  hosted_by: @ServerOwner
```

### Giveaway with Conditions
```
/giveaway create
  title: "Email Giveaway"
  description: "Win a digital prize"
  duration: 2880
  winners: 1
  condition: "DM me your email address within 24 hours"
  hosted_by: @Moderator
```

## Managing Giveaways

### List Active Giveaways
```
/giveaway list
```

Shows:
- 🎉 All active giveaways
- 👥 Entry counts
- 🏆 Winner counts
- ⏰ Time remaining
- 🎤 Host information
- Giveaway IDs

### Cancel a Giveaway
```
/giveaway cancel
  giveaway_id: [paste ID from list]
```

### Reroll a Winner
```
/giveaway reroll
  giveaway_id: [paste ID]
  winner: @Username
```

## Giveaway Embed Features

### Active Giveaway Display
- 🎉 **Title**: Eye-catching with emoji
- ✨ **Description**: Clear call-to-action
- 🏆 **Winners**: Number of winners
- ⏰ **Ends**: Countdown timer
- 👥 **Entries**: Live entry count
- 🎤 **Hosted by**: Host attribution (optional)
- 🔒 **Required Roles**: Role requirements (if any)
- 🎁 **Button**: Green "Enter Giveaway" button

### Winner Announcement
- 🎊 Celebration message
- 🏆 Winner list with mentions
- 🎤 Host credit
- 🎁 Encouraging footer
- Reroll instructions for moderators

### Ended Giveaway
- 🎉 Title with "Ended" status
- 🏆 Final winner list
- 🎤 Host attribution
- 🎁 Completion message
- Button removed

## Duration Examples

| Duration | Minutes | Use Case |
|----------|---------|----------|
| 1 hour | 60 | Quick giveaway |
| 12 hours | 720 | Half-day event |
| 1 day | 1440 | Daily giveaway |
| 2 days | 2880 | Weekend event |
| 1 week | 10080 | Major giveaway |

## Best Practices

### Titles
- ✅ "Discord Nitro Giveaway"
- ✅ "100 Server Boosts!"
- ✅ "Monthly Prize Pack"
- ❌ "giveaway" (too generic)
- ❌ "FREE STUFF!!!" (too spammy)

### Descriptions
- ✅ Clear and concise
- ✅ Mention prize details
- ✅ Include any special rules
- ❌ Too long or confusing
- ❌ Missing important details

### Host Attribution
- ✅ Credit sponsors and donors
- ✅ Highlight community partners
- ✅ Show appreciation to supporters
- ❌ Leave blank if self-hosted
- ❌ Use for non-existent users

### Conditions
- ✅ "DM me your email within 24 hours"
- ✅ "Must be active in the server"
- ✅ "Join our partner server: [link]"
- ❌ Overly complex requirements
- ❌ Impossible to verify conditions

## Emoji Guide

| Emoji | Meaning |
|-------|---------|
| 🎉 | Giveaway/Celebration |
| 🎁 | Prize/Gift |
| 🏆 | Winners |
| 👥 | Participants/Entries |
| ⏰ | Time/Countdown |
| 🎤 | Host |
| 🔒 | Requirements |
| ✨ | Special/Featured |
| 🎊 | Congratulations |
| 🔄 | Reroll |
| ❌ | Cancelled/Error |
| ✅ | Success/Confirmed |

## Common Issues

### "Invalid channel selected"
- Make sure you select a text channel
- Bot needs permission to send messages in that channel

### "You need one of the following roles"
- User doesn't have required role
- Check role requirements in giveaway embed

### "This giveaway has ended"
- Giveaway timer expired
- Cannot enter ended giveaways

### "You have already entered"
- User already clicked the button
- One entry per user per giveaway

## Permissions Required

To use giveaway commands, you need:
- `Manage Events` permission (default)
- Or be added to allowed roles/users via `/giveaway config`

## Configuration

### View Current Config
```
/giveaway config
  show: True
```

### Add Allowed Role
```
/giveaway config
  add_role: @GiveawayManager
```

### Add Allowed User
```
/giveaway config
  add_user: @TrustedModerator
```

### Remove Permissions
```
/giveaway config
  remove_role: @OldRole
```

## Tips for Success

1. **Timing**: Schedule giveaways when your community is most active
2. **Duration**: Longer giveaways get more entries but less urgency
3. **Prizes**: Valuable prizes attract more participants
4. **Promotion**: Announce giveaways in multiple channels
5. **Host Credit**: Always credit sponsors to encourage future support
6. **Requirements**: Keep role requirements reasonable
7. **Conditions**: Make winner conditions clear and achievable
8. **Follow-up**: Respond quickly to winners

## Support

If you encounter issues:
1. Check this guide first
2. Use `/giveaway list` to verify giveaway status
3. Check bot permissions in the channel
4. Contact server administrators
5. Review error messages carefully
