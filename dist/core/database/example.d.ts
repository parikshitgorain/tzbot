/**
 * Database Layer Usage Examples
 *
 * This file demonstrates how to use the database layer in TZBOT.
 */
/**
 * Example 1: Initialize database on startup
 */
declare function exampleInitialize(): Promise<void>;
/**
 * Example 2: Insert a user
 */
declare function exampleInsertUser(discordId: string, kickUsername?: string): Promise<any>;
/**
 * Example 3: Record a violation
 */
declare function exampleRecordViolation(userId: string, type: 'spam' | 'malicious_link' | 'unauthorized_post' | 'other', severity: number, details: string, punishment?: string): Promise<any>;
/**
 * Example 4: Get user violations in last 24 hours
 */
declare function exampleGetRecentViolations(userId: string): Promise<any[]>;
/**
 * Example 5: Create a giveaway
 */
declare function exampleCreateGiveaway(title: string, description: string, channelId: string, messageId: string, requiredRoles: string[], winnerCount: number, endsAt: Date): Promise<any>;
/**
 * Example 6: Add giveaway entry
 */
declare function exampleAddGiveawayEntry(giveawayId: string, userId: string): Promise<boolean>;
/**
 * Example 7: Get active giveaways
 */
declare function exampleGetActiveGiveaways(): Promise<any[]>;
/**
 * Example 8: Record chat activity
 */
declare function exampleRecordChatActivity(userId: string): Promise<void>;
/**
 * Example 9: Get active chatters (3+ messages in last 10 minutes)
 */
declare function exampleGetActiveChatters(): Promise<any[]>;
/**
 * Example 10: Using transactions
 */
declare function exampleTransaction(userId: string): Promise<void>;
/**
 * Example 11: Cleanup old data (7-day retention for messages)
 */
declare function exampleCleanupOldMessages(): Promise<number | null>;
/**
 * Example 12: Graceful shutdown
 */
declare function exampleShutdown(): Promise<void>;
export { exampleInitialize, exampleInsertUser, exampleRecordViolation, exampleGetRecentViolations, exampleCreateGiveaway, exampleAddGiveawayEntry, exampleGetActiveGiveaways, exampleRecordChatActivity, exampleGetActiveChatters, exampleTransaction, exampleCleanupOldMessages, exampleShutdown, };
//# sourceMappingURL=example.d.ts.map