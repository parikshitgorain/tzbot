/**
 * @file rate-limiter.example.ts
 * @description Example usage of the rate limiter
 */

import { rateLimiter, RateLimitPresets } from './rate-limiter.js';
import type { CommandInteraction, Message } from 'discord.js';

/**
 * Example 1: Rate limiting slash commands
 */
export async function exampleCommandRateLimit(interaction: CommandInteraction) {
  const userId = interaction.user.id;

  // Check command rate limit (10 per minute)
  const result = await rateLimiter.checkLimit(userId, RateLimitPresets.COMMAND);

  if (!result.allowed) {
    await interaction.reply({
      content: `⏱️ Slow down! You can use commands again in ${Math.ceil(result.retryAfter! / 1000)} seconds.`,
      ephemeral: true,
    });
    return;
  }

  // Execute command
  await interaction.reply({
    content: `✅ Command executed! You have ${result.remaining} commands remaining.`,
  });
}

/**
 * Example 2: Rate limiting API requests
 */
export async function exampleAPIRateLimit(userId: string) {
  // Check API rate limit (60 per minute)
  const result = await rateLimiter.checkLimit(userId, RateLimitPresets.API);

  if (!result.allowed) {
    throw new Error(
      `Rate limit exceeded. Retry after ${Math.ceil(result.retryAfter! / 1000)}s`
    );
  }

  // Make API request
  console.log(`API request allowed. Remaining: ${result.remaining}`);
  return { success: true, remaining: result.remaining };
}

/**
 * Example 3: Rate limiting AI responses
 */
export async function exampleAIRateLimit(message: Message) {
  const userId = message.author.id;

  // Check AI rate limit (1 per 30 seconds)
  const result = await rateLimiter.checkLimit(userId, RateLimitPresets.AI_RESPONSE);

  if (!result.allowed) {
    // Silently skip - don't spam user
    console.log(`AI rate limit exceeded for user ${userId}`);
    return;
  }

  // Generate AI response
  await message.reply('🤖 AI response generated!');
}

/**
 * Example 4: Custom rate limit
 */
export async function exampleCustomRateLimit(userId: string) {
  // Custom: 5 requests per 10 seconds
  const customConfig = {
    maxTokens: 5,
    refillRate: 0.5, // 0.5 tokens/second = 5 per 10 seconds
    keyPrefix: 'custom',
  };

  const result = await rateLimiter.checkLimit(userId, customConfig);

  if (!result.allowed) {
    console.log(`Custom rate limit exceeded. Retry after ${result.retryAfter}ms`);
    return false;
  }

  console.log(`Custom action allowed. Remaining: ${result.remaining}`);
  return true;
}

/**
 * Example 5: Consuming multiple tokens
 */
export async function exampleMultiTokenConsumption(userId: string) {
  // Heavy operation consumes 5 tokens
  const result = await rateLimiter.checkLimit(
    userId,
    RateLimitPresets.API,
    5 // consume 5 tokens
  );

  if (!result.allowed) {
    console.log('Not enough tokens for heavy operation');
    return false;
  }

  console.log(`Heavy operation allowed. Remaining: ${result.remaining}`);
  return true;
}

/**
 * Example 6: Checking rate limit status
 */
export async function exampleCheckStatus(userId: string) {
  // Check current token count without consuming
  const remaining = await rateLimiter.getStatus(userId, RateLimitPresets.API);

  console.log(`User ${userId} has ${remaining} API tokens remaining`);

  if (remaining < 10) {
    console.log('⚠️ User is running low on tokens');
  }

  return remaining;
}

/**
 * Example 7: Resetting rate limit (moderator action)
 */
export async function exampleResetRateLimit(userId: string, moderatorId: string) {
  // Moderator resets user's rate limit
  await rateLimiter.reset(userId, 'api');
  console.log(`Moderator ${moderatorId} reset rate limit for user ${userId}`);
}

/**
 * Example 8: Giveaway entry rate limit
 */
export async function exampleGiveawayEntry(userId: string, giveawayId: string) {
  // One entry per giveaway (no refill)
  const result = await rateLimiter.checkLimit(
    `${giveawayId}:${userId}`,
    RateLimitPresets.GIVEAWAY_ENTRY
  );

  if (!result.allowed) {
    console.log('User already entered this giveaway');
    return false;
  }

  console.log('Giveaway entry recorded');
  return true;
}

/**
 * Example 9: Express middleware for API rate limiting
 */
export function createRateLimitMiddleware() {
  return async (req: any, res: any, next: any) => {
    const userId = req.user?.id || req.ip;

    const result = await rateLimiter.checkLimit(userId, RateLimitPresets.API);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', RateLimitPresets.API.maxTokens);
    res.setHeader('X-RateLimit-Remaining', result.remaining);

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil(result.retryAfter! / 1000));
      res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: Math.ceil(result.retryAfter! / 1000),
      });
      return;
    }

    next();
  };
}

/**
 * Example 10: Burst handling
 */
export async function exampleBurstHandling(userId: string) {
  console.log('Testing burst capacity...');

  // User can make up to 60 requests immediately (burst)
  for (let i = 0; i < 65; i++) {
    const result = await rateLimiter.checkLimit(userId, RateLimitPresets.API);

    if (!result.allowed) {
      console.log(`Request ${i + 1} denied. Burst capacity exhausted.`);
      console.log(`Retry after ${Math.ceil(result.retryAfter! / 1000)}s`);
      break;
    }

    console.log(`Request ${i + 1} allowed. Remaining: ${result.remaining}`);
  }
}
