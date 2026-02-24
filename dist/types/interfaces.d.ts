/**
 * @file interfaces.ts
 * @description Shared interface definitions
 * @module types
 */
import type { User, Violation, Giveaway, ViolationType } from './models.js';
export interface Database {
    saveUser(user: User): Promise<void>;
    getUser(userId: string): Promise<User | null>;
    getUserByKickUsername(kickUsername: string): Promise<User | null>;
    saveViolation(violation: Violation): Promise<void>;
    getViolations(userId: string, since: Date): Promise<Violation[]>;
    clearViolations(userId: string): Promise<void>;
    saveGiveaway(giveaway: Giveaway): Promise<void>;
    getGiveaway(giveawayId: string): Promise<Giveaway | null>;
    addGiveawayEntry(giveawayId: string, userId: string): Promise<void>;
    recordChatActivity(userId: string, timestamp: Date): Promise<void>;
    getActiveChatters(since: Date): Promise<string[]>;
    recordChatRainWinner(userId: string, timestamp: Date): Promise<void>;
    getConfig(key: string): Promise<unknown>;
    setConfig(key: string, value: unknown): Promise<void>;
    deleteAllUserData(userId: string): Promise<void>;
    connect(): Promise<void>;
    disconnect(): Promise<void>;
}
export interface SpamResult {
    isSpam: boolean;
    reason?: string;
    violationType?: ViolationType;
    messageIds?: string[];
}
export interface LinkScanResult {
    isMalicious: boolean;
    reason?: string;
    detectedUrl?: string;
}
export interface HealthStatus {
    healthy: boolean;
    latency: number;
    lastCheck: Date;
    error?: string;
}
export interface SystemHealth {
    overall: 'healthy' | 'degraded' | 'down';
    components: {
        discord: HealthStatus;
        database: HealthStatus;
        cache: HealthStatus;
    };
    uptime: number;
    memoryUsage: number;
    cpuUsage: number;
}
export interface EscalationResult {
    punishmentLevel: import('./models.js').PunishmentLevel;
    violationCount: number;
    reason: string;
    shouldNotify: boolean;
}
/**
 * Punishment result from progressive spam punishment system
 */
export interface Punishment {
    type: import('./models.js').PunishmentType;
    duration?: number;
    nextPunishment: string;
}
/**
 * Result of notification delivery attempts
 */
export interface NotificationResult {
    dmSent: boolean;
    ephemeralSent: boolean;
    modLogSent: boolean;
    failures: string[];
}
//# sourceMappingURL=interfaces.d.ts.map