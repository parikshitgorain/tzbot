/**
 * @file models.ts
 * @description Data model type definitions
 * @module types
 */

export interface User {
  discordId: string;
  kickUsername?: string;
  roles: string[];
  violations: Violation[];
  lastChatRainWin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Violation {
  id: string;
  userId: string;
  type: ViolationType;
  severity: number;
  timestamp: Date;
  details: string;
  punishmentApplied?: PunishmentLevel;
}

/**
 * Offense record for progressive spam punishment system
 */
export interface OffenseRecord {
  user_id: string;
  total_offenses: number;
  last_offense_timestamp: Date | null;
  current_timeout_duration: number; // in hours
  is_banned: boolean;
  warning_history: OffenseEntry[];
}

/**
 * Individual offense entry in warning history
 */
export interface OffenseEntry {
  timestamp: Date;
  reason: string;
  punishment_applied: string; // PunishmentType as string
  moderator_id: string;
  timeout_duration?: number; // in hours
}

export interface Giveaway {
  id: string;
  title: string;
  description: string;
  channelId: string;
  messageId: string;
  requiredRoles: string[];
  winnerCount: number;
  entries: GiveawayEntry[];
  status: GiveawayStatus;
  endsAt: Date;
  createdAt: Date;
  condition?: string; // Optional condition/requirement for winners
  winners?: string[]; // Store winner IDs for reroll functionality
}

export interface GiveawayEntry {
  userId: string;
  timestamp: Date;
}

export interface NotificationEvent {
  id: string;
  type: EventType;
  channelId: string;
  data: unknown;
  timestamp: Date;
  delivered: boolean;
}

export enum ViolationType {
  SPAM = 'spam',
  MALICIOUS_LINK = 'malicious_link',
  UNAUTHORIZED_POST = 'unauthorized_post',
  OTHER = 'other',
}

export enum PunishmentLevel {
  WARNING = 'warning',
  TIMEOUT_1H = 'timeout_1h',
  TIMEOUT_2H = 'timeout_2h',
  TIMEOUT_4H = 'timeout_4h',
  TIMEOUT_8H = 'timeout_8h',
  TIMEOUT_16H = 'timeout_16h',
  TIMEOUT_24H = 'timeout_24h',
  BAN = 'ban',
}

/**
 * Punishment type for progressive spam punishment system
 */
export enum PunishmentType {
  WARNING = 'WARNING',
  TIMEOUT = 'TIMEOUT',
  PERMANENT_BAN = 'PERMANENT_BAN',
}

export enum GiveawayStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  CANCELLED = 'cancelled',
}

export enum EventType {
  STREAM_LIVE = 'stream_live',
  STREAM_OFFLINE = 'stream_offline',
  NEW_SUBSCRIBER = 'new_subscriber',
  NEW_VIP = 'new_vip',
  RAID = 'raid',
  HOST = 'host',
}
