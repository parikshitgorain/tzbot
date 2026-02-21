/**
 * @file index.ts
 * @description Kick API service exports
 * @module services/kick
 */

export { KickAPIClient, initializeKickAPIClient, getKickAPIClient } from './client.js';
export { KickChatClient, kickChatClient } from './chat-client.js';
export type {
  KickAPIConfig,
  OAuthTokenResponse,
  StoredTokens,
  KickChannel,
  KickSubscriber,
  KickVIP,
  KickStreamStatus,
  KickEvent,
  KickEventType,
  RequestOptions,
  KickAPIError,
  RetryConfig,
} from './types.js';
export type {
  KickChatClientOptions,
  UserBadgeInfo,
} from './chat-client.js';
