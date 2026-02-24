/**
 * @file user-linking.ts
 * @description User linking system for connecting Kick and Discord accounts
 * @module services/kick
 *
 * This system allows users to link their Kick and Discord accounts by:
 * 1. User runs /link command on Discord
 * 2. Bot generates unique token and DMs user
 * 3. User types "!verify TOKEN" in Kick chat
 * 4. Bot monitors Kick chat for verification
 * 5. Bot confirms link and assigns roles
 *
 * Requirements: 2.5, 2.6
 */
import type { UserRepository } from '../../core/database/repositories/UserRepository.js';
import type { KickChatMessage } from '../pusher/types.js';
/**
 * Linking token with expiration
 */
export interface LinkToken {
    token: string;
    discordId: string;
    expiresAt: Date;
}
/**
 * Linking result
 */
export interface LinkResult {
    success: boolean;
    discordId?: string;
    kickUsername?: string;
    error?: string;
}
/**
 * User linking system interface
 */
export interface IUserLinkingSystem {
    /**
     * Start the linking process for a Discord user
     * Generates a unique token that expires in 10 minutes
     */
    startLinking(discordId: string): Promise<LinkToken>;
    /**
     * Verify a linking token from Kick chat
     * Returns the Discord user ID if valid, null otherwise
     */
    verifyToken(token: string): Promise<string | null>;
    /**
     * Complete the account linking
     * Links the Discord user to the Kick username
     */
    completeLink(discordId: string, kickUsername: string): Promise<void>;
    /**
     * Unlink accounts
     * Removes the Kick username from the Discord user
     */
    unlinkAccounts(discordId: string): Promise<void>;
    /**
     * Check if a Discord user has a linked Kick account
     */
    isLinked(discordId: string): Promise<boolean>;
    /**
     * Get the Kick username for a Discord user
     */
    getKickUsername(discordId: string): Promise<string | null>;
    /**
     * Get the Discord ID for a Kick username
     */
    getDiscordId(kickUsername: string): Promise<string | null>;
    /**
     * Process a Kick chat message looking for verification commands
     * Returns link result if verification was attempted
     */
    processVerificationMessage(message: KickChatMessage): Promise<LinkResult | null>;
    /**
     * Clean up expired tokens
     */
    cleanupExpiredTokens(): Promise<void>;
}
/**
 * User linking system implementation
 */
export declare class UserLinkingSystem implements IUserLinkingSystem {
    private userRepository;
    private pendingLinks;
    private readonly TOKEN_LENGTH;
    private readonly TOKEN_EXPIRY_MS;
    private readonly VERIFY_COMMAND_PREFIX;
    constructor(userRepository: UserRepository);
    /**
     * Generate a cryptographically secure random token
     */
    private generateToken;
    /**
     * Start the linking process
     */
    startLinking(discordId: string): Promise<LinkToken>;
    /**
     * Verify a linking token
     */
    verifyToken(token: string): Promise<string | null>;
    /**
     * Complete the account linking
     */
    completeLink(discordId: string, kickUsername: string): Promise<void>;
    /**
     * Unlink accounts
     */
    unlinkAccounts(discordId: string): Promise<void>;
    /**
     * Check if a Discord user has a linked Kick account
     */
    isLinked(discordId: string): Promise<boolean>;
    /**
     * Get the Kick username for a Discord user
     */
    getKickUsername(discordId: string): Promise<string | null>;
    /**
     * Get the Discord ID for a Kick username
     */
    getDiscordId(kickUsername: string): Promise<string | null>;
    /**
     * Process a Kick chat message looking for verification commands
     */
    processVerificationMessage(message: KickChatMessage): Promise<LinkResult | null>;
    /**
     * Clean up expired tokens
     */
    cleanupExpiredTokens(): Promise<void>;
}
//# sourceMappingURL=user-linking.d.ts.map