/**
 * @file team-database.ts
 * @description Team member database for AI knowledge
 * @module ai/knowledge
 */

export interface TeamMember {
  role: string;
  displayName: string;
  username: string;
  discordId: string;
  description: string;
  responsibilities?: string[];
  communityIdentity?: string;
  status?: string;
  authority?: string;
  personality?: string[];
}

/**
 * TZBetz Team Database - Complete Ecosystem Profile
 * This is the source of truth for team member information
 */
export const TEAM_DATABASE: TeamMember[] = [
  {
    role: 'Owner',
    displayName: 'Tony Z',
    username: 'tz.betz',
    discordId: '1340127083061444668',
    description: 'Owner, Founder, and Main Streamer of TZBetz ecosystem. Vision leader, brand face, and final authority.',
    authority: 'Highest',
    responsibilities: [
      'Main streamer on Kick',
      'Community owner and founder',
      'Final decision maker',
      'Brand leadership',
      'Rainbet partnership',
      'Vision and strategy',
    ],
    status: 'Active',
    personality: ['Leader', 'Streamer', 'Community Builder'],
  },
  {
    role: 'Head Mod',
    displayName: 'Ark',
    username: 'p_arik',
    discordId: '1135807511841222706',
    description: 'Lead Developer & Head Moderator. Technical backbone and operational controller of the ecosystem.',
    authority: 'High',
    responsibilities: [
      'tzbetz.com development',
      'TZBot development & architecture',
      'Backend systems',
      'Discord governance',
      'Moderation oversight',
      'Technical infrastructure',
    ],
    status: 'Active',
    communityIdentity: 'Developer + top-level enforcement authority',
    personality: ['Technical', 'Developer', 'Administrator', 'Problem Solver'],
  },
  {
    role: 'Mod',
    displayName: 'elurb',
    username: 'elurb',
    discordId: '223830603424858112',
    description: 'Kick Stream Moderator - Top Degen and #1 leaderboard grinder. High-performance mod with competitive force.',
    status: 'Active',
    responsibilities: [
      'Kick stream moderation',
      'Discord moderation',
      'Community support',
      'Chat enforcement',
    ],
    communityIdentity: 'Top Degen - Consistently ranks #1 on leaderboard (monthly). Highly competitive. Strong presence in ecosystem.',
    personality: ['Competitive', 'Top Performer', 'Degen', 'Leaderboard King'],
  },
  {
    role: 'Mod',
    displayName: 'BOBOC',
    username: 'boboc_',
    discordId: '805738751891865630',
    description: 'Kick Stream Moderator - The golf man ⛳. Reliable mod with consistent activity and community-friendly personality.',
    status: 'Active',
    responsibilities: [
      'Kick stream moderation',
      'Discord moderation',
      'Community support',
      'Chat enforcement',
    ],
    communityIdentity: 'Known as "golf man" ⛳. Strong performer. Loves golf.',
    personality: ['Reliable', 'Friendly', 'Golf Enthusiast', 'Consistent'],
  },
  {
    role: 'Mod',
    displayName: 'chaquito',
    username: 'chaquito',
    discordId: '509216385101201409',
    description: 'Kick Stream Moderator - Degen with deep community roots. Whole family involved in degen culture.',
    status: 'Active',
    responsibilities: [
      'Kick stream moderation',
      'Discord moderation',
      'Community support',
      'Chat enforcement',
    ],
    communityIdentity: 'Degen. Whole family involved in degen culture. Strong loyalty presence. Deep community-rooted personality.',
    personality: ['Degen', 'Family-Oriented', 'Loyal', 'Community-Rooted'],
  },
  {
    role: 'Mod',
    displayName: 'Vavr',
    username: 'vavr1221',
    discordId: '775113132635848715',
    description: 'Kick Stream Moderator - Backup support moderator.',
    status: 'Less Active',
    responsibilities: [
      'Kick stream moderation',
      'Discord moderation',
      'Backup support',
    ],
    communityIdentity: 'Backup support moderator.',
    personality: ['Supportive', 'Backup'],
  },
];

/**
 * Get team member by Discord ID
 */
export function getTeamMemberById(discordId: string): TeamMember | undefined {
  return TEAM_DATABASE.find(member => member.discordId === discordId);
}

/**
 * Get team member by username
 */
export function getTeamMemberByUsername(username: string): TeamMember | undefined {
  return TEAM_DATABASE.find(
    member => member.username.toLowerCase() === username.toLowerCase()
  );
}

/**
 * Get team member by display name (fuzzy match)
 */
export function getTeamMemberByDisplayName(displayName: string): TeamMember | undefined {
  const lowerName = displayName.toLowerCase();
  return TEAM_DATABASE.find(
    member => member.displayName.toLowerCase() === lowerName ||
              member.displayName.toLowerCase().includes(lowerName) ||
              lowerName.includes(member.displayName.toLowerCase())
  );
}

/**
 * Get all team members by role
 */
export function getTeamMembersByRole(role: string): TeamMember[] {
  return TEAM_DATABASE.filter(
    member => member.role.toLowerCase() === role.toLowerCase()
  );
}

/**
 * Check if user is a team member
 */
export function isTeamMember(discordId: string): boolean {
  return TEAM_DATABASE.some(member => member.discordId === discordId);
}

/**
 * Check if user is a moderator (includes head mod)
 */
export function isModerator(discordId: string): boolean {
  const member = getTeamMemberById(discordId);
  return member ? ['Mod', 'Head Mod'].includes(member.role) : false;
}

/**
 * Check if user is owner
 */
export function isOwner(discordId: string): boolean {
  const member = getTeamMemberById(discordId);
  return member?.role === 'Owner';
}

/**
 * Get formatted team info for AI (detailed version)
 */
export function getTeamInfoForAI(): string {
  let info = '👑 TZBetz Team & Community Profiles:\n\n';
  
  // Owner
  const owner = TEAM_DATABASE.find(m => m.role === 'Owner');
  if (owner) {
    info += `**${owner.displayName}** (@${owner.username}) - ${owner.role}\n`;
    info += `${owner.description}\n`;
    if (owner.authority) info += `Authority: ${owner.authority}\n`;
    info += '\n';
  }
  
  // Head Mod
  const headMod = TEAM_DATABASE.find(m => m.role === 'Head Mod');
  if (headMod) {
    info += `**${headMod.displayName}** (@${headMod.username}) - ${headMod.role}\n`;
    info += `${headMod.description}\n`;
    if (headMod.communityIdentity) info += `Identity: ${headMod.communityIdentity}\n`;
    info += '\n';
  }
  
  // Mods
  const mods = TEAM_DATABASE.filter(m => m.role === 'Mod');
  info += '🛡 Moderators:\n\n';
  mods.forEach(mod => {
    info += `**${mod.displayName}** (@${mod.username})\n`;
    info += `${mod.description}\n`;
    if (mod.communityIdentity) info += `Identity: ${mod.communityIdentity}\n`;
    if (mod.status) info += `Status: ${mod.status}\n`;
    info += '\n';
  });
  
  return info;
}

/**
 * Get short team info for AI (concise version)
 */
export function getTeamInfoShort(): string {
  return `Team: Tony Z (Owner/Streamer), Ark (Head Mod/Developer), elurb (Mod/Top Degen), BOBOC (Mod/Golf Man), chaquito (Mod/Degen), Vavr (Mod/Backup)`;
}

/**
 * Search team members (fuzzy search)
 */
export function searchTeamMembers(query: string): TeamMember[] {
  const lowerQuery = query.toLowerCase();
  return TEAM_DATABASE.filter(member =>
    member.displayName.toLowerCase().includes(lowerQuery) ||
    member.username.toLowerCase().includes(lowerQuery) ||
    member.role.toLowerCase().includes(lowerQuery) ||
    member.description.toLowerCase().includes(lowerQuery) ||
    member.communityIdentity?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get member personality traits
 */
export function getMemberPersonality(discordId: string): string[] {
  const member = getTeamMemberById(discordId);
  return member?.personality || [];
}

