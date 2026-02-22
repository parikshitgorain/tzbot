/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * @file types.ts
 * @description Type definitions for Kick API client
 * @module services/kick
 *
 * Requirements: 2.1-2.4, 8.1-8.7, 14.6
 */

/**
 * OAuth 2.0 token response
 */
export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Stored OAuth tokens with expiration tracking
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

/**
 * Kick API client configuration
 */
export interface KickAPIConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl?: string;
}

/**
 * Kick channel information
 */
export interface KickChannel {
  id: number;
  slug: string;
  user_id: number;
  username: string;
  is_live: boolean;
  subscriber_count: number;
  follower_count: number;
}

/**
 * Kick subscriber information
 */
export interface KickSubscriber {
  id: number;
  username: string;
  subscribed_at: Date;
  months: number;
}

/**
 * Kick VIP information
 */
export interface KickVIP {
  id: number;
  username: string;
  granted_at: Date;
}

/**
 * Kick stream status
 */
export interface KickStreamStatus {
  id: number;
  channel_id: number;
  is_live: boolean;
  started_at?: Date;
  title?: string;
  viewer_count?: number;
  category?: string;
}

/**
 * Kick event types
 */
export type KickEventType =
  | 'stream_live'
  | 'stream_offline'
  | 'new_subscriber'
  | 'new_vip'
  | 'raid'
  | 'host';

/**
 * Kick event data
 */
export interface KickEvent {
  id: string;
  type: KickEventType;
  channel_id: number;
  data: any;
  timestamp: Date;
}

/**
 * API request options
 */
export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  retries?: number;
}

/**
 * API error response
 */
export interface KickAPIError {
  error: string;
  error_description?: string;
  status: number;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}
