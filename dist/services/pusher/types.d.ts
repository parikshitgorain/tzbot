/**
 * @file types.ts
 * @description Type definitions for Pusher/Kick chat integration
 * @module services/pusher
 */
export interface KickChatMessage {
    id: string;
    username: string;
    content: string;
    timestamp: Date;
    badges: KickChatBadge[];
}
export interface KickChatBadge {
    type: 'subscriber' | 'vip' | 'moderator' | 'broadcaster';
    months?: number;
}
export interface PusherConfig {
    cluster: string;
    encrypted: boolean;
}
export type ConnectionState = 'initialized' | 'connecting' | 'connected' | 'disconnected' | 'failed';
export interface PusherConnectionOptions {
    channelId: string;
    onMessage?: (message: KickChatMessage) => void;
    onConnectionChange?: (state: ConnectionState) => void;
    onError?: (error: Error) => void;
}
//# sourceMappingURL=types.d.ts.map