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
    current_timeout_duration: number;
    is_banned: boolean;
    warning_history: OffenseEntry[];
}
/**
 * Individual offense entry in warning history
 */
export interface OffenseEntry {
    timestamp: Date;
    reason: string;
    punishment_applied: string;
    moderator_id: string;
    timeout_duration?: number;
}
export interface Giveaway {
    id: string;
    guildId: string;
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
    condition?: string;
    winners?: string[];
    hostedBy?: string;
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
export declare enum ViolationType {
    SPAM = "spam",
    MALICIOUS_LINK = "malicious_link",
    UNAUTHORIZED_POST = "unauthorized_post",
    OTHER = "other"
}
export declare enum PunishmentLevel {
    WARNING = "warning",
    TIMEOUT_1H = "timeout_1h",
    TIMEOUT_2H = "timeout_2h",
    TIMEOUT_4H = "timeout_4h",
    TIMEOUT_8H = "timeout_8h",
    TIMEOUT_16H = "timeout_16h",
    TIMEOUT_24H = "timeout_24h",
    BAN = "ban"
}
/**
 * Punishment type for progressive spam punishment system
 */
export declare enum PunishmentType {
    WARNING = "WARNING",
    TIMEOUT = "TIMEOUT",
    PERMANENT_BAN = "PERMANENT_BAN"
}
export declare enum GiveawayStatus {
    ACTIVE = "active",
    ENDED = "ended",
    CANCELLED = "cancelled"
}
export declare enum EventType {
    STREAM_LIVE = "stream_live",
    STREAM_OFFLINE = "stream_offline",
    NEW_SUBSCRIBER = "new_subscriber",
    NEW_VIP = "new_vip",
    RAID = "raid",
    HOST = "host",
    SPAM_DETECTED = "spam_detected",
    MALICIOUS_LINK_DETECTED = "malicious_link_detected"
}
/**
 * Winner status for giveaway winner confirmation system
 */
export declare enum WinnerStatus {
    PENDING = "PENDING",
    CONFIRMED = "CONFIRMED",
    REROLLED = "REROLLED"
}
/**
 * Winner record for giveaway winner confirmation system
 */
export interface WinnerRecord {
    id: string;
    giveawayId: string;
    userId: string;
    status: WinnerStatus;
    selectedAt: Date;
    confirmedAt?: Date;
    rerolledAt?: Date;
    timerStartTime: Date | null;
    timerActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
/**
 * Giveaway configuration for permission management
 */
export interface GiveawayConfig {
    guildId: string;
    allowedRoles: string[];
    allowedUsers: string[];
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=models.d.ts.map