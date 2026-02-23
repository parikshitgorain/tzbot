# Giveaway Command Examples

## Basic Commands

### 1. Simple Giveaway (No Host)
```
/giveaway create
  title: "100 Server Coins"
  description: "Win 100 server coins to spend in our shop!"
  duration: 60
  winners: 1
```

**Result:**
- Creates a 1-hour giveaway
- 1 winner
- Open to everyone
- No host attribution

---

### 2. Giveaway with Host
```
/giveaway create
  title: "Discord Nitro Giveaway"
  description: "Win 1 month of Discord Nitro!"
  duration: 1440
  winners: 1
  hosted_by: @CommunityPartner
```

**Result:**
- Creates a 24-hour giveaway
- 1 winner
- Shows "🎤 Hosted by: @CommunityPartner"
- Open to everyone

---

### 3. Role-Restricted Giveaway with Host
```
/giveaway create
  title: "VIP Exclusive Prize Pack"
  description: "Special prize pack for our VIP members!"
  duration: 2880
  winners: 3
  hosted_by: @ServerOwner
  role1: @VIP
  role2: @Premium
```

**Result:**
- Creates a 48-hour giveaway
- 3 winners
- Only users with @VIP or @Premium role can enter
- Shows host attribution

---

### 4. Giveaway with Condition
```
/giveaway create
  title: "Steam Game Key"
  description: "Win a Steam game key of your choice!"
  duration: 4320
  winners: 1
  hosted_by: @GameDonor
  condition: "DM me your Steam username within 24 hours of winning"
```

**Result:**
- Creates a 3-day giveaway
- Winners receive DM with condition
- Host is credited

---

### 5. Multi-Channel Giveaway
```
/giveaway create
  title: "Server Boost Giveaway"
  description: "Win a server boost!"
  duration: 720
  winners: 2
  hosted_by: @Moderator
  channel: #announcements
```

**Result:**
- Posts in #announcements instead of current channel
- 12-hour duration
- 2 winners

---

## Advanced Examples

### 6. Large Community Giveaway
```
/giveaway create
  title: "🎮 Gaming Setup Giveaway 🎮"
  description: "Win a complete gaming setup worth $2000! Includes gaming PC, monitor, keyboard, mouse, and headset. Thank you to our amazing sponsor!"
  duration: 10080
  winners: 1
  hosted_by: @TechSponsor
  channel: #giveaways
```

**Result:**
- 7-day (1 week) giveaway
- High-value prize
- Posted in dedicated giveaway channel
- Sponsor credited

---

### 7. Multiple Winners with Roles
```
/giveaway create
  title: "Supporter Appreciation Giveaway"
  description: "Thank you to all our supporters! Win exclusive server perks."
  duration: 1440
  winners: 10
  hosted_by: @ServerTeam
  role1: @Supporter
  role2: @Booster
  role3: @Donor
```

**Result:**
- 24-hour giveaway
- 10 winners
- Only supporters, boosters, and donors can enter
- Team credited as host

---

### 8. Quick Flash Giveaway
```
/giveaway create
  title: "⚡ Flash Giveaway ⚡"
  description: "Quick 15-minute giveaway! Be fast!"
  duration: 15
  winners: 1
  hosted_by: @Moderator
```

**Result:**
- Very short 15-minute giveaway
- Creates urgency
- 1 winner

---

## Management Commands

### 9. List Active Giveaways
```
/giveaway list
```

**Shows:**
```
🎉 Active Giveaways
Total active giveaways: 3

Discord Nitro Giveaway
Channel: #giveaways
👥 Entries: 45
🏆 Winners: 1
⏰ Ends: in 5 hours
🎤 Hosted by: @CommunityPartner
ID: abc123def456

Server Boost Giveaway
Channel: #announcements
👥 Entries: 23
🏆 Winners: 2
⏰ Ends: in 12 hours
🎤 Hosted by: @Moderator
ID: def456ghi789

VIP Prize Pack
Channel: #giveaways
👥 Entries: 12
🏆 Winners: 3
⏰ Ends: in 2 days
🎤 Hosted by: @ServerOwner
ID: ghi789jkl012
```

---

### 10. Cancel a Giveaway
```
/giveaway cancel
  giveaway_id: abc123def456
```

**Result:**
- Giveaway is cancelled
- Message updated to show cancellation
- Host attribution remains visible
- Button removed

---

### 11. Reroll a Winner
```
/giveaway reroll
  giveaway_id: abc123def456
  winner: @OldWinner
```

**Result:**
- Selects new winner from remaining entries
- Announces reroll in channel
- Shows both old and new winner
- Host attribution included
- New winner receives DM

---

## Configuration Commands

### 12. View Current Config
```
/giveaway config
  show: True
```

**Shows:**
```
🎉 Giveaway Command Permissions

Allowed Roles: @GiveawayManager, @Moderator
Allowed Users: @TrustedUser1, @TrustedUser2
```

---

### 13. Add Allowed Role
```
/giveaway config
  add_role: @EventManager
```

**Result:**
- @EventManager role can now use giveaway commands
- Success confirmation message

---

### 14. Add Allowed User
```
/giveaway config
  add_user: @CommunityHelper
```

**Result:**
- @CommunityHelper can now use giveaway commands
- Success confirmation message

---

### 15. Remove Permissions
```
/giveaway config
  remove_role: @OldRole
```

**Result:**
- @OldRole can no longer use giveaway commands
- Success confirmation message

---

## Real-World Scenarios

### Scenario 1: Partner Sponsorship
```
/giveaway create
  title: "Partner Server Nitro Giveaway"
  description: "Our partner server is giving away 5 Discord Nitro subscriptions! Join their server to increase your chances: discord.gg/partner"
  duration: 2880
  winners: 5
  hosted_by: @PartnerServerOwner
  channel: #partnerships
```

---

### Scenario 2: Milestone Celebration
```
/giveaway create
  title: "🎊 10K Members Celebration! 🎊"
  description: "We hit 10,000 members! To celebrate, we're giving away 10 prizes to our amazing community!"
  duration: 4320
  winners: 10
  hosted_by: @ServerOwner
  channel: #announcements
```

---

### Scenario 3: Content Creator Collab
```
/giveaway create
  title: "YouTube Creator Giveaway"
  description: "Our featured creator is giving away exclusive merch! Subscribe to their channel: youtube.com/creator"
  duration: 10080
  winners: 3
  hosted_by: @YouTubeCreator
  condition: "DM me your YouTube username to verify subscription"
  channel: #creator-collabs
```

---

### Scenario 4: Seasonal Event
```
/giveaway create
  title: "🎄 Holiday Special Giveaway 🎄"
  description: "Happy Holidays! Win amazing prizes to celebrate the season!"
  duration: 7200
  winners: 5
  hosted_by: @ServerTeam
  channel: #events
```

---

### Scenario 5: Booster Appreciation
```
/giveaway create
  title: "Server Booster Thank You"
  description: "Thank you to all our boosters! This exclusive giveaway is just for you."
  duration: 1440
  winners: 3
  hosted_by: @ServerOwner
  role1: @Server Booster
  channel: #booster-perks
```

---

## Tips for Command Usage

### Duration Guidelines
- **Flash (1-30 min)**: High urgency, quick participation
- **Short (1-6 hours)**: Active time window, good for events
- **Medium (12-48 hours)**: Balanced, gives everyone a chance
- **Long (3-7 days)**: Maximum participation, major prizes

### Winner Count Guidelines
- **1 winner**: Standard, creates excitement
- **2-3 winners**: Good balance, more chances
- **5-10 winners**: Community-wide, milestone events
- **10+ winners**: Special occasions, major celebrations

### Host Attribution Best Practices
- Always credit sponsors and donors
- Use for partner collaborations
- Show appreciation to community members
- Leave blank if self-hosted by server

### Condition Examples
- "DM me your email within 24 hours"
- "Must be active in the server"
- "Join our partner server: [link]"
- "Subscribe to our YouTube channel"
- "Follow us on Twitter: @handle"

### Channel Selection
- `#giveaways`: Dedicated giveaway channel
- `#announcements`: Important, high-visibility
- `#events`: Special occasions
- `#partnerships`: Sponsored giveaways
- Current channel: Quick, contextual giveaways

---

## Common Mistakes to Avoid

❌ **Don't:**
- Use extremely short durations (< 5 minutes) unless intentional
- Set winner count higher than expected entries
- Forget to credit sponsors (use hosted_by)
- Make conditions too complex or unverifiable
- Use inappropriate channels

✅ **Do:**
- Choose appropriate duration for your community
- Credit sponsors and hosts
- Keep conditions clear and achievable
- Use dedicated giveaway channels
- Test with small giveaways first
- Monitor entries and adjust future giveaways

---

## Success Metrics

Track these to improve future giveaways:
- Entry count vs. server size
- Time to reach target entries
- Winner response rate
- Community feedback
- Sponsor satisfaction
- Repeat participation

---

## Need Help?

- Check `/giveaway list` to see active giveaways
- Use `/giveaway config show:True` to verify permissions
- Review `docs/GIVEAWAY_QUICK_REFERENCE.md` for detailed guide
- Contact server administrators for support
