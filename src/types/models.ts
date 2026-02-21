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
  TIMEOUT_5M = 'timeout_5m',
  TIMEOUT_1H = 'timeout_1h',
  TIMEOUT_24H = 'timeout_24h',
  BAN = 'ban',
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
